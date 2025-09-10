import type { FastifyBaseLogger } from 'fastify';
import { getTokenNewsSummary } from '../services/news-analyst.js';
import { getTechnicalOutlook } from '../services/technical-analyst.js';
import { getOrderBookAnalysis } from '../services/order-book-analyst.js';
import { getPerformanceAnalysis } from '../services/performance-analyst.js';
import { TOKEN_SYMBOLS, isStablecoin } from '../util/tokens.js';
import { setCache, getCache, acquireLock, releaseLock } from '../util/cache.js';
import {
  callAi,
  developerInstructions,
  rebalanceResponseSchema,
  type RebalancePrompt,
  type PreviousResponse,
} from '../util/ai.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import type { Analysis } from '../services/types.js';
import {
  getRecentLimitOrders,
  getOpenLimitOrdersForAgent,
  updateLimitOrderStatus,
} from '../repos/limit-orders.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { getActiveAgents, type ActiveAgentRow } from '../repos/agents.js';
import { insertReviewResult, getRecentReviewResults } from '../repos/agent-review-result.js';
import { parseExecLog, validateExecResponse } from '../util/parse-exec-log.js';
import {
  fetchAccount,
  fetchPairData,
  cancelOrder,
  parseBinanceError,
} from '../services/binance.js';
import { createRebalanceLimitOrder } from '../services/rebalance.js';

async function runWithCache<T>(
  log: FastifyBaseLogger,
  key: string,
  fn: () => Promise<T | null>,
): Promise<T | null> {
  const cached = await getCache<T>(key);
  if (cached) return cached;
  if (!acquireLock(key)) {
    log.info({ key }, 'step already running');
    return null;
  }
  try {
    const res = await fn();
    if (res) await setCache(key, res);
    return res ?? null;
  } catch (err) {
    log.error({ err, key }, 'step failed');
    return null;
  } finally {
    releaseLock(key);
  }
}

async function runPerItem<T>(
  log: FastifyBaseLogger,
  items: T[],
  buildKey: (item: T) => string,
  fn: (item: T) => Promise<Analysis | null>,
): Promise<void> {
  for (const item of items) {
    await runWithCache(log, buildKey(item), () => fn(item));
  }
}

/**
 * Step 1: News Analyst
 * Loads token list, fetches news and caches summaries per token.
 */
export async function runNewsAnalyst(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  runId: string,
  agentId: string,
): Promise<void> {
  // cache token list
  await setCache(`tokens:${model}`, TOKEN_SYMBOLS);

  await runPerItem(
    log,
    TOKEN_SYMBOLS.filter((t) => !isStablecoin(t)),
    (token) => `news:${model}:${token}:${runId}`,
    async (token) => {
      const { analysis, prompt, response } = await getTokenNewsSummary(
        token,
        model,
        apiKey,
        log,
      );
      if (prompt && response)
        await insertReviewRawLog({ agentId, prompt, response });
      return analysis;
    },
  );
}

/**
 * Step 2: Technical Analyst
 * Computes technical indicators and caches outlook per token.
 */
export async function runTechnicalAnalyst(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  timeframe: string,
  runId: string,
  agentId: string,
): Promise<void> {
  const tokens =
    (await getCache<string[]>(`tokens:${model}`)) ?? TOKEN_SYMBOLS;
  await runPerItem(
    log,
    tokens.filter((t) => !isStablecoin(t)),
    (token) => `tech:${model}:${token}:${timeframe}:${runId}`,
    async (token) => {
      const { analysis, prompt, response } = await getTechnicalOutlook(
        token,
        model,
        apiKey,
        timeframe,
        log,
      );
      if (prompt && response)
        await insertReviewRawLog({ agentId, prompt, response });
      return analysis;
    },
  );
}

/**
 * Step 3: Order Book Analyst
 * Analyzes order book snapshots per trading pair.
 */
export async function runOrderBookAnalyst(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  runId: string,
  agentId: string,
): Promise<void> {
  const tokens =
    (await getCache<string[]>(`tokens:${model}`)) ?? TOKEN_SYMBOLS;
  const pairs = tokens
    .filter((t) => !isStablecoin(t))
    .map((t) => `${t}USDT`);
  await runPerItem(
    log,
    pairs,
    (pair) => `orderbook:${model}:${pair}:${runId}`,
    async (pair) => {
      const { analysis, prompt, response } = await getOrderBookAnalysis(
        pair,
        model,
        apiKey,
        log,
      );
      if (prompt && response)
        await insertReviewRawLog({ agentId, prompt, response });
      return analysis;
    },
  );
}

/**
 * Step 4: Performance Analyzer
 * Reviews prior analyses and recent order outcomes.
 */
export async function runPerformanceAnalyzer(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  timeframe: string,
  agentId: string,
  runId: string,
): Promise<void> {
  await runWithCache(log, `performance:${model}:${agentId}:${runId}`, async () => {
    const tokens =
      (await getCache<string[]>(`tokens:${model}`)) ?? TOKEN_SYMBOLS;
    const reports: {
      token: string;
      news: Analysis | null;
      tech: Analysis | null;
      orderbook: Analysis | null;
    }[] = [];
    for (const token of tokens) {
      const news = await getCache<Analysis>(`news:${model}:${token}:${runId}`);
      const tech = await getCache<Analysis>(
        `tech:${model}:${token}:${timeframe}:${runId}`,
      );
      const pair = `${token}USDT`;
      const orderbook = isStablecoin(token)
        ? null
        : await getCache<Analysis>(`orderbook:${model}:${pair}:${runId}`);
      reports.push({ token, news: news ?? null, tech: tech ?? null, orderbook });
    }
    const ordersRaw = await getRecentLimitOrders(agentId, 20);
    const orders = ordersRaw
      .filter((o) => o.status === 'canceled' || o.status === 'filled')
      .map((o) => ({
        status: o.status,
        created_at: o.created_at.toISOString(),
        planned: JSON.parse(o.planned_json),
      }));
    const { analysis, prompt, response } = await getPerformanceAnalysis(
      { reports, orders },
      model,
      apiKey,
      log,
    );
    if (prompt && response)
      await insertReviewRawLog({ agentId, prompt, response });
    return analysis;
  });
}

function extractResult(res: string): any {
  try {
    const json = JSON.parse(res);
    const outputs = Array.isArray((json as any).output) ? (json as any).output : [];
    const msg = outputs.find((o: any) => o.type === 'message' || o.id?.startsWith('msg_'));
    const text = msg?.content?.[0]?.text;
    if (typeof text !== 'string') return null;
    const parsed = JSON.parse(text);
    return parsed.result ?? null;
  } catch {
    return null;
  }
}

/**
 * Step 5: Main Trader
 * Runs prior analysts, aggregates reports and caches portfolio decisions.
 */
export async function runMainTrader(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  timeframe: string,
  agentId: string,
  portfolioId: string,
  runId: string,
): Promise<void> {
  await Promise.all([
    runNewsAnalyst(log, model, apiKey, runId, agentId),
    runTechnicalAnalyst(log, model, apiKey, timeframe, runId, agentId),
    runOrderBookAnalyst(log, model, apiKey, runId, agentId),
  ]);

  await runPerformanceAnalyzer(log, model, apiKey, timeframe, agentId, runId);

  await runWithCache(
    log,
    `portfolio:${model}:${portfolioId}:${runId}`,
    async () => {
      const tokens =
        (await getCache<string[]>(`tokens:${model}`)) ?? TOKEN_SYMBOLS;
      const reports: {
        token: string;
        news: Analysis | null;
        tech: Analysis | null;
        orderbook: Analysis | null;
      }[] = [];

      for (const token of tokens) {
        const news = isStablecoin(token)
          ? null
          : await getCache<Analysis>(`news:${model}:${token}:${runId}`);
        if (!news || news.comment === 'Analysis unavailable')
          log.error({ token }, 'news analysis unavailable');
        const tech = isStablecoin(token)
          ? null
          : await getCache<Analysis>(
              `tech:${model}:${token}:${timeframe}:${runId}`,
            );
        if (!tech || tech.comment === 'Analysis unavailable')
          log.error({ token }, 'technical analysis unavailable');
        const pair = `${token}USDT`;
        const orderbook = isStablecoin(token)
          ? null
          : await getCache<Analysis>(`orderbook:${model}:${pair}:${runId}`);
        if (!isStablecoin(token) && (!orderbook || orderbook.comment === 'Analysis unavailable'))
          log.error({ pair }, 'order book analysis unavailable');
        reports.push({ token, news, tech, orderbook });
      }
      const performance = await getCache<Analysis>(
        `performance:${model}:${agentId}:${runId}`,
      );
      const prompt = { portfolioId, reports, performance };
      const res = await callAi(
        model,
        developerInstructions,
        rebalanceResponseSchema,
        prompt,
        apiKey,
        true,
      );
      await insertReviewRawLog({ agentId, prompt, response: res });
      const decision = extractResult(res);
      if (!decision) {
        log.error('main trader returned invalid response');
        return null;
      }
      return decision;
    },
  );
}

/*
 * -----------------------------------------------------------------------------
 * Portfolio review orchestration (migrated from jobs/review-portfolio.ts)
 * -----------------------------------------------------------------------------
 */

/** Agents currently under review. Used to avoid concurrent runs. */
const runningAgents = new Set<string>();

export function removeAgentFromSchedule(id: string) {
  runningAgents.delete(id);
}

export async function reviewAgentPortfolio(
  log: FastifyBaseLogger,
  agentId: string,
): Promise<void> {
  const agents = await getActiveAgents({ agentId });
  const { toRun, skipped } = filterRunningAgents(agents);
  if (skipped.length) throw new Error('Agent is already reviewing portfolio');
  await runAgents(log, toRun);
}

export default async function reviewPortfolios(
  log: FastifyBaseLogger,
  interval: string,
): Promise<void> {
  const agents = await getActiveAgents({ interval });
  const { toRun } = filterRunningAgents(agents);
  if (!toRun.length) return;
  await runAgents(log, toRun);
}

async function runAgents(
  log: FastifyBaseLogger,
  agents: ActiveAgentRow[],
) {
  const prepared = await prepareAgents(agents, log);

  await Promise.all(
    prepared.map(({ row, prompt, key, log: lg }) =>
      executeAgent(row, prompt, key, lg).finally(() => {
        runningAgents.delete(row.id);
      }),
    ),
  );
}

function filterRunningAgents(agents: ActiveAgentRow[]) {
  const toRun: ActiveAgentRow[] = [];
  const skipped: ActiveAgentRow[] = [];
  for (const row of agents) {
    if (runningAgents.has(row.id)) skipped.push(row);
    else {
      runningAgents.add(row.id);
      toRun.push(row);
    }
  }
  return { toRun, skipped };
}

async function prepareAgents(
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
      runningAgents.delete(row.id);
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
      runningAgents.delete(row.id);
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

async function buildPreviousOrders(agentId: string) {
  const rows = await getRecentLimitOrders(agentId, 5);
  if (!rows.length) return {};
  return {
    prev_orders: rows.map((r) => {
      const planned = JSON.parse(r.planned_json) as Record<string, any>;
      return {
        symbol: planned.symbol,
        side: planned.side,
        amount: planned.quantity,
        datetime: new Date(r.created_at).toISOString(),
        status: r.status,
      };
    }),
  } as const;
}

async function executeAgent(
  row: ActiveAgentRow,
  prompt: RebalancePrompt,
  key: string,
  log: FastifyBaseLogger,
) {
  try {
    const runId = Date.now().toString();
    await runMainTrader(
      log,
      row.model,
      key,
      row.review_interval,
      row.id,
      row.portfolio_id,
      runId,
    );
    const decision =
      (await getCache<
        { rebalance: boolean; newAllocation?: number; shortReport: string }
      >(`portfolio:${row.model}:${row.portfolio_id}:${runId}`)) ?? null;
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


