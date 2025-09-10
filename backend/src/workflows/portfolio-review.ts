import type { FastifyBaseLogger } from 'fastify';
import { getActiveAgents, type ActiveAgentRow } from '../repos/agents.js';
import { runMainTrader } from '../agents/main-trader.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import {
  getOpenLimitOrdersForAgent,
  updateLimitOrderStatus,
} from '../repos/limit-orders.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import {
  insertReviewResult,
  getRecentReviewResults,
} from '../repos/agent-review-result.js';
import { parseExecLog, validateExecResponse } from '../util/parse-exec-log.js';
import {
  fetchAccount,
  fetchPairData,
  cancelOrder,
  parseBinanceError,
} from '../services/binance.js';
import { createRebalanceLimitOrder } from '../services/rebalance.js';
import { buildPreviousOrders } from '../agents/performance-analyst.js';
import { type RebalancePrompt, type PreviousResponse } from '../util/ai.js';

/** Workflows currently running. Used to avoid concurrent runs. */
const runningWorkflows = new Set<string>();

export function removeWorkflowFromSchedule(id: string) {
  runningWorkflows.delete(id);
}

export async function reviewAgentPortfolio(
  log: FastifyBaseLogger,
  agentId: string,
): Promise<void> {
  const agents = await getActiveAgents({ agentId });
  const { toRun, skipped } = filterRunningWorkflows(agents);
  if (skipped.length) throw new Error('Agent is already reviewing portfolio');
  await runAgents(log, toRun);
}

export default async function reviewPortfolios(
  log: FastifyBaseLogger,
  interval: string,
): Promise<void> {
  const agents = await getActiveAgents({ interval });
  const { toRun } = filterRunningWorkflows(agents);
  if (!toRun.length) return;
  await runAgents(log, toRun);
}

async function runAgents(
  log: FastifyBaseLogger,
  agents: ActiveAgentRow[],
) {
  const prepared = await prepareAgents(agents, log);
  const preparedIds = new Set(prepared.map((p) => p.row.id));
  for (const row of agents) {
    if (!preparedIds.has(row.id)) runningWorkflows.delete(row.id);
  }

  await Promise.all(
    prepared.map(({ row, prompt, key, log: lg }) =>
      executeAgent(row, prompt, key, lg).finally(() => {
        runningWorkflows.delete(row.id);
      }),
    ),
  );
}

function filterRunningWorkflows(agents: ActiveAgentRow[]) {
  const toRun: ActiveAgentRow[] = [];
  const skipped: ActiveAgentRow[] = [];
  for (const row of agents) {
    if (runningWorkflows.has(row.id)) skipped.push(row);
    else {
      runningWorkflows.add(row.id);
      toRun.push(row);
    }
  }
  return { toRun, skipped };
}

export async function prepareAgents(
  rows: ActiveAgentRow[],
  parentLog: FastifyBaseLogger,
) {
  const prepared: {
    row: ActiveAgentRow;
    prompt: RebalancePrompt;
    key: string;
    log: FastifyBaseLogger;
  }[] = [];

  for (const row of rows) {
    const log = parentLog.child({
      userId: row.user_id,
      agentId: row.id,
    });

    await cleanupAgentOpenOrders(row, log);

    const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);

    const balances = await fetchBalances(row, log);
    if (!balances) {
      continue;
    }

    try {
      const token1 = row.tokens[0].token;
      const token2 = row.tokens[1].token;
      const [pair, price1Data, price2Data] = await Promise.all([
        fetchPairData(token1, token2),
        token1 === 'USDT' || token1 === 'USDC'
          ? Promise.resolve({ currentPrice: 1 })
          : fetchPairData(token1, 'USDT'),
        token2 === 'USDT' || token2 === 'USDC'
          ? Promise.resolve({ currentPrice: 1 })
          : fetchPairData(token2, 'USDT'),
      ]);

      const { floor, positions } = computePortfolioValues(
        row,
        balances,
        price1Data.currentPrice,
        price2Data.currentPrice,
      );

      const prevOrders = await buildPreviousOrders(row.id);

      const prompt: RebalancePrompt = {
        instructions: row.agent_instructions,
        policy: { floor },
        portfolio: {
          ts: new Date().toISOString(),
          positions,
        },
        ...prevOrders,
        marketData: { currentPrice: pair.currentPrice },
      };

      const prevRows = await getRecentReviewResults(row.id, 5);
      prompt.previous_responses = prevRows
        .map(extractPreviousResponse)
        .filter(Boolean) as PreviousResponse[];

      prepared.push({ row, prompt, key, log });
    } catch (err) {
      const msg = 'failed to fetch market data';
      await saveFailure(row, msg);
      log.error({ err }, 'agent run failed');
      continue;
    }
  }

  return prepared;
}

function extractPreviousResponse(r: any): PreviousResponse | undefined {
  const res: PreviousResponse = {};
  if (typeof r.rebalance === 'boolean') res.rebalance = r.rebalance;
  if (typeof r.newAllocation === 'number') res.newAllocation = r.newAllocation;
  if (typeof r.shortReport === 'string') res.shortReport = r.shortReport;
  if (r.error !== undefined && r.error !== null) res.error = r.error;
  return Object.keys(res).length ? res : undefined;
}

async function cleanupAgentOpenOrders(
  row: ActiveAgentRow,
  log: FastifyBaseLogger,
) {
  const orders = await getOpenLimitOrdersForAgent(row.id);
  for (const o of orders) {
    const planned = JSON.parse(o.planned_json);
    try {
      await cancelOrder(o.user_id, {
        symbol: planned.symbol,
        orderId: Number(o.order_id),
      });
      await updateLimitOrderStatus(o.user_id, o.order_id, 'canceled');
      log.info({ orderId: o.order_id }, 'canceled stale order');
    } catch (err) {
      const msg = parseBinanceError(err);
      if (msg && /UNKNOWN_ORDER/i.test(msg)) {
        await updateLimitOrderStatus(o.user_id, o.order_id, 'filled');
      } else {
        log.error({ err }, 'failed to cancel order');
      }
    }
  }
}

async function fetchBalances(
  row: ActiveAgentRow,
  log: FastifyBaseLogger,
): Promise<{ token1Balance: number; token2Balance: number } | undefined> {
  const token1 = row.tokens[0].token;
  const token2 = row.tokens[1].token;
  let token1Balance: number | undefined;
  let token2Balance: number | undefined;
  try {
    const account = await fetchAccount(row.user_id);
    if (account) {
      const bal1 = account.balances.find((b) => b.asset === token1);
      if (bal1) token1Balance = Number(bal1.free) + Number(bal1.locked);
      const bal2 = account.balances.find((b) => b.asset === token2);
      if (bal2) token2Balance = Number(bal2.free) + Number(bal2.locked);
    }
  } catch (err) {
    log.error({ err }, 'failed to fetch balance');
  }
  if (token1Balance === undefined || token2Balance === undefined) {
    const msg = 'failed to fetch token balances';
    await saveFailure(row, msg);
    log.error({ err: msg }, 'agent run failed');
    return undefined;
  }
  return { token1Balance, token2Balance };
}

function computePortfolioValues(
  row: ActiveAgentRow,
  balances: { token1Balance: number; token2Balance: number },
  price1: number,
  price2: number,
) {
  const token1 = row.tokens[0].token;
  const token2 = row.tokens[1].token;
  const min1 = row.tokens[0].min_allocation;
  const min2 = row.tokens[1].min_allocation;
  const value1 = balances.token1Balance * price1;
  const value2 = balances.token2Balance * price2;
  const floor: Record<string, number> = {
    [token1]: min1,
    [token2]: min2,
  };
  const positions = [
    {
      sym: token1,
      qty: balances.token1Balance,
      price_usdt: price1,
      value_usdt: value1,
    },
    {
      sym: token2,
      qty: balances.token2Balance,
      price_usdt: price2,
      value_usdt: value2,
    },
  ];
  return { floor, positions };
}

export async function executeAgent(
  row: ActiveAgentRow,
  prompt: RebalancePrompt,
  key: string,
  log: FastifyBaseLogger,
) {
  try {
    const decision = await runMainTrader(
      log,
      row.model,
      key,
      row.review_interval,
      row.id,
      row.portfolio_id,
    );
    const logId = await insertReviewRawLog({
      agentId: row.id,
      prompt,
      response: decision,
    });
    const validationError = validateExecResponse(
      decision ?? undefined,
      prompt.policy,
    );
    if (validationError) log.error({ err: validationError }, 'validation failed');
    const resultId = await insertReviewResult({
      agentId: row.id,
      log: decision ? JSON.stringify(decision) : '',
      rawLogId: logId,
      ...(decision && !validationError
        ? {
            rebalance: decision.rebalance,
            newAllocation: decision.newAllocation,
            shortReport: decision.shortReport,
          }
        : {}),
      ...((!decision || validationError)
        ? { error: { message: validationError ?? 'decision unavailable' } }
        : {}),
    });
    if (
      decision &&
      !validationError &&
      !row.manual_rebalance &&
      decision.rebalance &&
      decision.newAllocation !== undefined
    ) {
      await createRebalanceLimitOrder({
        userId: row.user_id,
        tokens: row.tokens.map((t) => t.token),
        positions: prompt.portfolio.positions,
        newAllocation: decision.newAllocation,
        log,
        reviewResultId: resultId,
      });
    }
    log.info('agent run complete');
  } catch (err) {
    await saveFailure(row, String(err), prompt);
    log.error({ err }, 'agent run failed');
  }
}

async function saveFailure(
  row: ActiveAgentRow,
  message: string,
  prompt?: RebalancePrompt,
) {
  let rawId: string | undefined;
  if (prompt) {
    rawId = await insertReviewRawLog({
      agentId: row.id,
      prompt,
      response: { error: message },
    });
  }
  const parsed = parseExecLog({ error: message });
  await insertReviewResult({
    agentId: row.id,
    log: parsed.text,
    ...(rawId ? { rawLogId: rawId } : {}),
    ...(parsed.response
      ? {
          rebalance: parsed.response.rebalance,
          newAllocation: parsed.response.newAllocation,
          shortReport: parsed.response.shortReport,
        }
      : {}),
    ...(parsed.error ? { error: parsed.error } : {}),
  });
}

