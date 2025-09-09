import type { FastifyBaseLogger } from 'fastify';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import {
  getActiveAgents,
  type ActiveAgentRow,
} from '../repos/agents.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import {
  insertReviewResult,
  getRecentReviewResults,
} from '../repos/agent-review-result.js';
import {
  getRecentLimitOrders,
  getOpenLimitOrdersForAgent,
  updateLimitOrderStatus,
} from '../repos/limit-orders.js';
import { parseExecLog, validateExecResponse } from '../util/parse-exec-log.js';
import { callRebalancingAgent } from '../util/ai.js';
import {
  fetchAccount,
  fetchPairData,
  fetchMarketTimeseries,
  fetchPairInfo,
  cancelOrder,
  parseBinanceError,
  fetchFearGreedIndex,
  type FearGreedIndex,
} from '../services/binance.js';

import {
  fetchOpenInterest,
  fetchFundingRate,
  fetchOrderBook,
} from '../services/derivatives.js'; 
import { createRebalanceLimitOrder } from '../services/rebalance.js';
import {
  fetchTokenIndicators,
  type TokenIndicators,
} from '../services/indicators.js';
import { getTokenNewsSummary } from '../services/news-analyst.js';
import { isStablecoin } from '../util/tokens.js';
import type { RebalancePrompt, PreviousResponse } from '../util/ai.js';

type MarketTimeseries = Awaited<ReturnType<typeof fetchMarketTimeseries>>;

/**
 * Agents currently under review. Used to avoid concurrent runs.
 */
const runningAgents = new Set<string>();

export function removeAgentFromSchedule(id: string) {
  runningAgents.delete(id);
}

type PairCacheData = Awaited<ReturnType<typeof fetchPairInfo>> & {
  currentPrice: number;
};

type PromptCache = {
  pairData: Map<string, PairCacheData>;
  indicators: Map<string, TokenIndicators>;
  timeseries: Map<string, MarketTimeseries>;
  fearGreed?: FearGreedIndex;
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
    fearGreed: undefined,
  };

  try {
    cache.fearGreed = await fetchFearGreedIndex();
  } catch (err) {
    log.error({ err }, 'failed to fetch fear & greed index');
  }

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

    await cleanupAgentOpenOrders(row, log);

    const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);

    const balances = await fetchBalances(row, log);
    if (!balances) {
      runningAgents.delete(row.id);
      continue;
    }

    const prompt = await buildPrompt(row, balances, log, cache, key);
    if (!prompt) {
      runningAgents.delete(row.id);
      continue;
    }

    const prevRows = await getRecentReviewResults(row.id, 5);
    prompt.previous_responses = prevRows
      .map(extractPreviousResponse)
      .filter(Boolean) as PreviousResponse[];

    prepared.push({ row, prompt, key, log });
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

async function buildPrompt(
  row: ActiveAgentRow,
  balances: { token1Balance: number; token2Balance: number },
  log: FastifyBaseLogger,
  cache: PromptCache,
  apiKey: string,
): Promise<RebalancePrompt | undefined> {
  try {
    const {
      pairData,
      price1,
      price2,
      ind1,
      ind2,
      ts1,
      ts2,
      openInterest,
      fundingRate,
      orderBook,
    } = await fetchPromptData(row, cache, log);
    const { floor, positions } = computePortfolioValues(
      row,
      balances,
      price1,
      price2,
    );
    const prevOrders = await buildPreviousOrders(row.id);
    const token1 = row.tokens[0].token;
    const token2 = row.tokens[1].token;
    const [news1, news2] = await Promise.all([
      getTokenNewsSummary(token1, row.model, apiKey),
      getTokenNewsSummary(token2, row.model, apiKey),
    ]);
    const marketData = assembleMarketData(
      row,
      pairData,
      ind1,
      ind2,
      ts1,
      ts2,
      cache.fearGreed,
      openInterest,
      fundingRate,
      orderBook,
    );
    const news: Record<string, string> = {};
    if (news1) news[token1] = news1;
    if (news2) news[token2] = news2;
    if (Object.keys(news).length) (marketData as any).newsReports = news;
    return {
      instructions: row.agent_instructions,
      policy: { floor },
      portfolio: {
        ts: new Date().toISOString(),
        positions,
      },
      ...prevOrders,
      marketData,
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
  log: FastifyBaseLogger,
): Promise<{
  pairData: PairCacheData;
  price1: number;
  price2: number;
  ind1?: TokenIndicators;
  ind2?: TokenIndicators;
  ts1?: MarketTimeseries;
  ts2?: MarketTimeseries;
  openInterest?: number;
  fundingRate?: number;
  orderBook?: { bid: [number, number]; ask: [number, number] };
}> {
  const token1 = row.tokens[0].token;
  const token2 = row.tokens[1].token;
  const pairKey = `${token1}-${token2}`;
  let pairData = cache.pairData.get(pairKey);
  if (!pairData) {
    const [data, info] = await Promise.all([
      fetchPairData(token1, token2),
      fetchPairInfo(token1, token2),
    ]);
    pairData = { ...data, ...info } as PairCacheData;
    cache.pairData.set(pairKey, pairData);
  }

  async function getPrice(sym: string): Promise<{ currentPrice: number }> {
    if (sym === 'USDT' || sym === 'USDC') return { currentPrice: 1 };
    const key = `${sym}-USDT`;
    let val = cache.pairData.get(key);
    if (!val) {
      const [data, info] = await Promise.all([
        fetchPairData(sym, 'USDT'),
        fetchPairInfo(sym, 'USDT'),
      ]);
      val = { ...data, ...info } as PairCacheData;
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

  const [price1Data, price2Data, ind1, ind2, ts1, ts2] = await Promise.all([
    getPrice(token1),
    getPrice(token2),
    getIndicators(token1),
    getIndicators(token2),
    getTimeseries(token1),
    getTimeseries(token2),
  ]);

  let openInterest: number | undefined;
  let fundingRate: number | undefined;
  let orderBook: { bid: [number, number]; ask: [number, number] } | undefined;
  const derivatives = await Promise.allSettled([
    fetchOpenInterest(pairData.symbol),
    fetchFundingRate(pairData.symbol),
    fetchOrderBook(pairData.symbol),
  ]);
  if (derivatives[0].status === 'fulfilled') openInterest = derivatives[0].value;
  else
    log.error(
      { err: derivatives[0].reason, symbol: pairData.symbol },
      'failed to fetch open interest',
    );
  if (derivatives[1].status === 'fulfilled') fundingRate = derivatives[1].value;
  else
    log.error(
      { err: derivatives[1].reason, symbol: pairData.symbol },
      'failed to fetch funding rate',
    );
  if (derivatives[2].status === 'fulfilled') orderBook = derivatives[2].value;
  else
    log.error(
      { err: derivatives[2].reason, symbol: pairData.symbol },
      'failed to fetch order book',
    );

  return {
    pairData,
    price1: price1Data.currentPrice,
    price2: price2Data.currentPrice,
    ind1,
    ind2,
    ts1,
    ts2,
    openInterest,
    fundingRate,
    orderBook,
  };
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

/**
 * Serialize minimal information about the most recent limit orders. The prompt
 * doesn't need the entire planning payload, so we only include the attributes
 * that are relevant for providing context: symbol, side, quantity, timestamp
 * and final status.
 */
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

function assembleMarketData(
  row: ActiveAgentRow,
  pairData: PairCacheData,
  ind1?: TokenIndicators,
  ind2?: TokenIndicators,
  ts1?: MarketTimeseries,
  ts2?: MarketTimeseries,
  fearGreed?: FearGreedIndex,
  openInterest?: number,
  fundingRate?: number,
  orderBook?: { bid: [number, number]; ask: [number, number] },
) {
  const token1 = row.tokens[0].token;
  const token2 = row.tokens[1].token;
  const ind1Flat = flattenIndicators(ind1);
  const ind2Flat = flattenIndicators(ind2);
  const ts1Flat = summarizeTimeseries(ts1);
  const ts2Flat = summarizeTimeseries(ts2);
  return {
    currentPrice: pairData.currentPrice,
    ...(fearGreed ? { fearGreedIndex: fearGreed } : {}),
    ...(typeof openInterest === 'number' ? { openInterest } : {}),
    ...(typeof fundingRate === 'number' ? { fundingRate } : {}),
    ...(orderBook ? { orderBook } : {}),
    ...(ind1Flat || ind2Flat
      ? {
          indicators: {
            ...(ind1Flat ? { [token1]: ind1Flat } : {}),
            ...(ind2Flat ? { [token2]: ind2Flat } : {}),
          },
        }
      : {}),
    ...(ts1Flat || ts2Flat
      ? {
          market_timeseries: {
            ...(ts1Flat ? { [`${token1}USDT`]: ts1Flat } : {}),
            ...(ts2Flat ? { [`${token2}USDT`]: ts2Flat } : {}),
          },
        }
      : {}),
  };
}

function flattenIndicators(ind?: TokenIndicators) {
  if (!ind) return undefined;
  return {
    ret_1h: ind.ret['1h'],
    ret_4h: ind.ret['4h'],
    ret_24h: ind.ret['24h'],
    ret_7d: ind.ret['7d'],
    ret_30d: ind.ret['30d'],
    sma_dist_20: ind.sma_dist['20'],
    sma_dist_50: ind.sma_dist['50'],
    sma_dist_200: ind.sma_dist['200'],
    macd_hist: ind.macd_hist,
    vol_rv_7d: ind.vol.rv_7d,
    vol_rv_30d: ind.vol.rv_30d,
    vol_atr_pct: ind.vol.atr_pct,
    range_bb_bw: ind.range.bb_bw,
    range_donchian20: ind.range.donchian20,
    volume_z_1h: ind.volume.z_1h,
    volume_z_24h: ind.volume.z_24h,
    corr_BTC_30d: ind.corr.BTC_30d,
    regime_BTC: ind.regime.BTC,
    osc_rsi_14: ind.osc.rsi_14,
    osc_stoch_k: ind.osc.stoch_k,
    osc_stoch_d: ind.osc.stoch_d,
  };
}

function summarizeTimeseries(ts?: MarketTimeseries) {
  if (!ts) return undefined;
  function pct(arr: [number, number, number, number][]) {
    if (!arr.length) return undefined;
    const start = arr[0][1];
    const end = arr[arr.length - 1][2];
    return ((end - start) / start) * 100;
  }
  function pctMonth(arr: [number, number, number][]) {
    if (!arr.length) return undefined;
    const start = arr[0][1];
    const end = arr[arr.length - 1][2];
    return ((end - start) / start) * 100;
  }
  const minute = pct(ts.minute_60);
  const hour = pct(ts.hourly_24h);
  const month = pctMonth(ts.monthly_24m);
  const res: Record<string, number> = {};
  if (minute !== undefined) res.ret_60m = minute;
  if (hour !== undefined) res.ret_24h = hour;
  if (month !== undefined) res.ret_24m = month;
  return Object.keys(res).length ? (res as any) : undefined;
}

async function executeAgent(
  row: ActiveAgentRow,
  prompt: RebalancePrompt,
  key: string,
  log: FastifyBaseLogger,
) {
  try {
    const text = await callRebalancingAgent(row.model, prompt, key);
    const logId = await insertReviewRawLog({
      agentId: row.id,
      prompt,
      response: text,
    });
    const parsed = parseExecLog(text);
    const validationError = validateExecResponse(parsed.response, prompt.policy);
    if (validationError) log.error({ err: validationError }, 'validation failed');
    const resultId = await insertReviewResult({
      agentId: row.id,
      log: parsed.text,
      rawLogId: logId,
      ...(parsed.response && !validationError
        ? {
            rebalance: parsed.response.rebalance,
            newAllocation: parsed.response.newAllocation,
            shortReport: parsed.response.shortReport,
          }
        : {}),
      ...((parsed.error || validationError)
        ? { error: parsed.error ?? { message: validationError } }
        : {}),
    });
    if (
      !validationError &&
      !row.manual_rebalance &&
      parsed.response?.rebalance &&
      parsed.response.newAllocation !== undefined
    ) {
      await createRebalanceLimitOrder({
        userId: row.user_id,
        tokens: row.tokens.map((t) => t.token),
        positions: prompt.portfolio.positions,
        newAllocation: parsed.response.newAllocation,
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

