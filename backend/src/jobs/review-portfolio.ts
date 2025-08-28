import type { FastifyBaseLogger } from 'fastify';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import {
  getActiveAgents,
  type ActiveAgentRow,
} from '../repos/agents.js';
import { insertExecLog } from '../repos/agent-exec-log.js';
import {
  insertExecResult,
  getRecentExecResults,
} from '../repos/agent-exec-result.js';
import { parseExecLog } from '../util/parse-exec-log.js';
import { callRebalancingAgent } from '../util/ai.js';
import {
  fetchAccount,
  fetchPairData,
  fetchMarketTimeseries,
} from '../services/binance.js';
import { createRebalanceLimitOrder } from '../services/rebalance.js';
import {
  fetchTokenIndicators,
  type TokenIndicators,
} from '../services/indicators.js';
import { isStablecoin } from '../util/tokens.js';
import type { RebalancePrompt } from '../util/ai.js';

type MarketTimeseries = Awaited<ReturnType<typeof fetchMarketTimeseries>>;

/**
 * Agents currently under review. Used to avoid concurrent runs.
 */
const runningAgents = new Set<string>();

type PromptCache = {
  pairData: Map<string, { currentPrice: number }>;
  indicators: Map<string, TokenIndicators>;
  timeseries: Map<string, MarketTimeseries>;
};

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
  const cache: PromptCache = {
    pairData: new Map(),
    indicators: new Map(),
    timeseries: new Map(),
  };

  const prepared = await prepareAgents(agents, log, cache);

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
  cache: PromptCache,
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

    const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);

    const balances = await fetchBalances(row, log);
    if (!balances) {
      runningAgents.delete(row.id);
      continue;
    }

    const prompt = await buildPrompt(row, balances, log, cache);
    if (!prompt) {
      runningAgents.delete(row.id);
      continue;
    }

    const prevRows = await getRecentExecResults(row.id, 5);
    prompt.previous_responses = prevRows.map((r: any) => {
      const str = JSON.stringify(r);
      return str === '{}' ? '' : str;
    });

    prepared.push({ row, prompt, key, log });
  }

  return prepared;
}

async function fetchBalances(
  row: ActiveAgentRow,
  log: FastifyBaseLogger,
): Promise<{ tokenABalance: number; tokenBBalance: number } | undefined> {
  let tokenABalance: number | undefined;
  let tokenBBalance: number | undefined;
  try {
    const account = await fetchAccount(row.user_id);
    if (account) {
      const balA = account.balances.find((b) => b.asset === row.token_a);
      if (balA) tokenABalance = Number(balA.free) + Number(balA.locked);
      const balB = account.balances.find((b) => b.asset === row.token_b);
      if (balB) tokenBBalance = Number(balB.free) + Number(balB.locked);
    }
  } catch (err) {
    log.error({ err }, 'failed to fetch balance');
  }
  if (tokenABalance === undefined || tokenBBalance === undefined) {
    const msg = 'failed to fetch token balances';
    await saveFailure(row, msg);
    log.error({ err: msg }, 'agent run failed');
    return undefined;
  }
  return { tokenABalance, tokenBBalance };
}

async function buildPrompt(
  row: ActiveAgentRow,
  balances: { tokenABalance: number; tokenBBalance: number },
  log: FastifyBaseLogger,
  cache: PromptCache,
): Promise<RebalancePrompt | undefined> {
  try {
    const {
      pairData,
      priceA,
      priceB,
      indA,
      indB,
      tsA,
      tsB,
    } = await fetchPromptData(row, cache);
    const { floorPercents, positions, weights } = computePortfolioValues(
      row,
      balances,
      priceA,
      priceB,
    );
    return {
      instructions: row.agent_instructions,
      config: {
        policy: { floorPercents },
        portfolio: {
          ts: new Date().toISOString(),
          positions,
          weights,
        },
      },
      marketData: assembleMarketData(row, pairData, indA, indB, tsA, tsB),
    };
  } catch (err) {
    const msg = 'failed to fetch market data';
    await saveFailure(row, msg);
    log.error({ err }, 'agent run failed');
    return undefined;
  }
}

async function fetchPromptData(
  row: ActiveAgentRow,
  cache: PromptCache,
): Promise<{
  pairData: { currentPrice: number };
  priceA: number;
  priceB: number;
  indA?: TokenIndicators;
  indB?: TokenIndicators;
  tsA?: MarketTimeseries;
  tsB?: MarketTimeseries;
}> {
  const pairKey = `${row.token_a}-${row.token_b}`;
  let pairData = cache.pairData.get(pairKey);
  if (!pairData) {
    pairData = await fetchPairData(row.token_a, row.token_b);
    cache.pairData.set(pairKey, pairData);
  }

  async function getPrice(sym: string): Promise<{ currentPrice: number }> {
    if (sym === 'USDT') return { currentPrice: 1 };
    const key = `${sym}-USDT`;
    let val = cache.pairData.get(key);
    if (!val) {
      val = await fetchPairData(sym, 'USDT');
      cache.pairData.set(key, val);
    }
    return val;
  }

  async function getIndicators(sym: string): Promise<TokenIndicators | undefined> {
    if (isStablecoin(sym)) return undefined;
    if (cache.indicators.has(sym)) return cache.indicators.get(sym);
    const ind = await fetchTokenIndicators(sym);
    cache.indicators.set(sym, ind);
    return ind;
  }

  async function getTimeseries(sym: string): Promise<MarketTimeseries | undefined> {
    if (isStablecoin(sym)) return undefined;
    const key = `${sym}USDT`;
    if (cache.timeseries.has(key)) return cache.timeseries.get(key);
    const ts = await fetchMarketTimeseries(key);
    cache.timeseries.set(key, ts);
    return ts;
  }

  const [priceAData, priceBData, indA, indB, tsA, tsB] = await Promise.all([
    getPrice(row.token_a),
    getPrice(row.token_b),
    getIndicators(row.token_a),
    getIndicators(row.token_b),
    getTimeseries(row.token_a),
    getTimeseries(row.token_b),
  ]);

  return {
    pairData,
    priceA: priceAData.currentPrice,
    priceB: priceBData.currentPrice,
    indA,
    indB,
    tsA,
    tsB,
  };
}

function computePortfolioValues(
  row: ActiveAgentRow,
  balances: { tokenABalance: number; tokenBBalance: number },
  priceA: number,
  priceB: number,
) {
  const valueA = balances.tokenABalance * priceA;
  const valueB = balances.tokenBBalance * priceB;
  const totalValue = valueA + valueB;
  const floorPercents: Record<string, number> = {
    [row.token_a]: row.min_a_allocation,
    [row.token_b]: row.min_b_allocation,
  };
  const positions = [
    {
      sym: row.token_a,
      qty: balances.tokenABalance,
      price_usdt: priceA,
      value_usdt: valueA,
    },
    {
      sym: row.token_b,
      qty: balances.tokenBBalance,
      price_usdt: priceB,
      value_usdt: valueB,
    },
  ];
  const weights: Record<string, number> = {
    [row.token_a]: totalValue ? valueA / totalValue : 0,
    [row.token_b]: totalValue ? valueB / totalValue : 0,
  };
  return { floorPercents, positions, weights };
}

function assembleMarketData(
  row: ActiveAgentRow,
  pairData: { currentPrice: number },
  indA?: TokenIndicators,
  indB?: TokenIndicators,
  tsA?: MarketTimeseries,
  tsB?: MarketTimeseries,
) {
  return {
    currentPrice: pairData.currentPrice,
    ...(indA || indB
      ? {
          indicators: {
            ...(indA ? { [row.token_a]: indA } : {}),
            ...(indB ? { [row.token_b]: indB } : {}),
          },
        }
      : {}),
    ...(tsA || tsB
      ? {
          market_timeseries: {
            ...(tsA ? { [`${row.token_a}USDT`]: tsA } : {}),
            ...(tsB ? { [`${row.token_b}USDT`]: tsB } : {}),
          },
        }
      : {}),
  };
}

async function executeAgent(
  row: ActiveAgentRow,
  prompt: RebalancePrompt,
  key: string,
  log: FastifyBaseLogger,
) {
  try {
    const text = await callRebalancingAgent(row.model, prompt, key);
    const logId = await insertExecLog({
      agentId: row.id,
      prompt,
      response: text,
    });
    const parsed = parseExecLog(text);
    const resultId = await insertExecResult({
      agentId: row.id,
      log: parsed.text,
      ...(parsed.response
        ? {
            rebalance: parsed.response.rebalance,
            newAllocation: parsed.response.newAllocation,
            shortReport: parsed.response.shortReport,
          }
        : {}),
      ...(parsed.error ? { error: parsed.error } : {}),
    });
    if (
      !row.manual_rebalance &&
      parsed.response?.rebalance &&
      parsed.response.newAllocation !== undefined
    ) {
      await createRebalanceLimitOrder({
        userId: row.user_id,
        tokenA: row.token_a,
        tokenB: row.token_b,
        positions: prompt.config.portfolio.positions,
        newAllocation: parsed.response.newAllocation,
        log,
        execResultId: resultId,
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
  await insertExecLog({
    agentId: row.id,
    ...(prompt ? { prompt } : {}),
    response: { error: message },
  });
  const parsed = parseExecLog({ error: message });
  await insertExecResult({
    agentId: row.id,
    log: parsed.text,
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

