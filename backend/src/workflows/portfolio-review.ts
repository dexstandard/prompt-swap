import type { FastifyBaseLogger } from 'fastify';
import { getTokenNewsSummary } from '../services/news-analyst.js';
import { getTechnicalOutlook } from '../services/technical-analyst.js';
import { getOrderBookAnalysis } from '../services/order-book-analyst.js';
import { getPerformanceAnalysis } from '../services/performance-analyst.js';
import { TOKEN_SYMBOLS, isStablecoin } from '../util/tokens.js';
import { setCache, getCache, acquireLock, releaseLock } from '../util/cache.js';
import { callTraderAgent } from '../util/ai.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import type { Analysis } from '../services/types.js';
import { getRecentLimitOrders } from '../repos/limit-orders.js';

/**
 * Step 1: News Analyst
 * Loads token list, fetches news and caches summaries per token.
 */
export async function runNewsAnalyst(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  runId: string,
): Promise<void> {
  // cache token list
  await setCache(`tokens:${model}`, TOKEN_SYMBOLS);

  // summarize news per token, skip stablecoins
  for (const token of TOKEN_SYMBOLS) {
    if (isStablecoin(token)) continue;
    const key = `news:${model}:${token}:${runId}`;
    if (await getCache(key)) continue;
    if (!acquireLock(key)) {
      log.info({ token }, 'news summary already running');
      continue;
    }
    try {
      const summary = await getTokenNewsSummary(token, model, apiKey);
      if (summary) await setCache(key, summary);
    } catch (err) {
      log.error({ err, token }, 'failed to summarize news');
    } finally {
      releaseLock(key);
    }
  }
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
): Promise<void> {
  const tokens =
    (await getCache<string[]>(`tokens:${model}`)) ?? TOKEN_SYMBOLS;
  for (const token of tokens) {
    if (isStablecoin(token)) continue;
    const key = `tech:${model}:${token}:${timeframe}:${runId}`;
    if (await getCache(key)) continue;
    if (!acquireLock(key)) {
      log.info({ token }, 'technical analysis already running');
      continue;
    }
    try {
      const outlook = await getTechnicalOutlook(token, model, apiKey, timeframe);
      if (outlook) await setCache(key, outlook);
    } catch (err) {
      log.error({ err, token }, 'failed to compute technical outlook');
    } finally {
      releaseLock(key);
    }
  }
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
): Promise<void> {
  const tokens =
    (await getCache<string[]>(`tokens:${model}`)) ?? TOKEN_SYMBOLS;
  const pairs = tokens
    .filter((t) => !isStablecoin(t))
    .map((t) => `${t}USDT`);
  for (const pair of pairs) {
    const key = `orderbook:${model}:${pair}:${runId}`;
    if (await getCache(key)) continue;
    if (!acquireLock(key)) {
      log.info({ pair }, 'order book analysis already running');
      continue;
    }
    try {
      const analysis = await getOrderBookAnalysis(pair, model, apiKey);
      if (analysis) await setCache(key, analysis);
    } catch (err) {
      log.error({ err, pair }, 'failed to analyze order book');
    } finally {
      releaseLock(key);
    }
  }
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
  const key = `performance:${model}:${agentId}:${runId}`;
  if (await getCache(key)) return;
  if (!acquireLock(key)) {
    log.info('performance analysis already running');
    return;
  }
  try {
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
      const tech = await getCache<Analysis>(`tech:${model}:${token}:${timeframe}:${runId}`);
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
    const analysis = await getPerformanceAnalysis({ reports, orders }, model, apiKey);
    if (analysis) await setCache(key, analysis);
  } catch (err) {
    log.error({ err }, 'failed to run performance analyzer');
  } finally {
    releaseLock(key);
  }
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
    runNewsAnalyst(log, model, apiKey, runId),
    runTechnicalAnalyst(log, model, apiKey, timeframe, runId),
    runOrderBookAnalyst(log, model, apiKey, runId),
  ]);

  const tokens = (await getCache<string[]>(`tokens:${model}`)) ?? TOKEN_SYMBOLS;
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
    const tech = isStablecoin(token)
      ? null
      : await getCache<Analysis>(
          `tech:${model}:${token}:${timeframe}:${runId}`,
        );
    const pair = `${token}USDT`;
    const orderbook = isStablecoin(token)
      ? null
      : await getCache<Analysis>(`orderbook:${model}:${pair}:${runId}`);
    reports.push({ token, news, tech, orderbook });
  }
  const prompt = { portfolioId, reports };
  const res = await callTraderAgent(model, prompt, apiKey);
  await insertReviewRawLog({ agentId, prompt, response: res });
  const decision = extractResult(res);
  if (!decision) {
    log.error('main trader returned invalid response');
  }
}

