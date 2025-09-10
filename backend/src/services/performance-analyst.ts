import type { FastifyBaseLogger } from 'fastify';
import { callAi, extractJson } from '../util/ai.js';
import { type AnalysisLog, type Analysis, analysisSchema } from './types.js';
import { getRecentLimitOrders } from '../repos/limit-orders.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';

export async function getPerformanceAnalysis(
  input: unknown,
  model: string,
  apiKey: string,
  log: FastifyBaseLogger,
): Promise<AnalysisLog> {
  const reports = Array.isArray((input as any)?.reports)
    ? (input as any).reports
    : [];
  const orders = Array.isArray((input as any)?.orders)
    ? (input as any).orders
    : [];
  if (reports.length === 0 && orders.length === 0) return { analysis: null };
  const instructions =
    'You are a performance analyst. Review the provided analyst reports and recent order outcomes to evaluate how well the trading team performed. Return a brief comment and a performance score from 0-10.';
  const fallback: Analysis = { comment: 'Analysis unavailable', score: 0 };
  try {
    const res = await callAi(model, instructions, analysisSchema, input, apiKey);
    const analysis = extractJson<Analysis>(res);
    if (!analysis) {
      log.error({ input, response: res }, 'performance analyst returned invalid response');
      return { analysis: fallback, prompt: { instructions, input }, response: res };
    }
    return { analysis, prompt: { instructions, input }, response: res };
  } catch (err) {
    log.error({ err }, 'performance analyst call failed');
    return { analysis: fallback };
  }
}

export async function runPerformanceAnalyzer(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  agentId: string,
  reports: {
    token: string;
    news: Analysis | null;
    tech: Analysis | null;
    orderbook: Analysis | null;
  }[],
): Promise<Analysis | null> {
  try {
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
    return analysis ?? null;
  } catch (err) {
    log.error({ err }, 'performance analyzer step failed');
    return null;
  }
}

export async function buildPreviousOrders(agentId: string, limit = 5) {
  const rows = await getRecentLimitOrders(agentId, limit);
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
