import type { FastifyBaseLogger } from 'fastify';
import { callAi, extractJson, type RebalancePrompt } from '../util/ai.js';
import { type AnalysisLog, type Analysis, analysisSchema, type RunParams } from './types.js';
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
  { log, model, apiKey, portfolioId }: RunParams,
  prompt: RebalancePrompt,
): Promise<void> {
  try {
    const fetched = await getRecentLimitOrders(portfolioId, 20);
    const orders = fetched
      .filter((o) => o.status === 'canceled' || o.status === 'filled')
      .map((o) => ({
        status: o.status,
        created_at: o.created_at.toISOString(),
        planned: JSON.parse(o.planned_json),
      }));
    if (!orders.length) {
      prompt.performance = null;
      return;
    }
    const { analysis, prompt: p, response } = await getPerformanceAnalysis(
      { reports: prompt.reports, orders },
      model,
      apiKey,
      log,
    );
    if (p && response)
      await insertReviewRawLog({ portfolioId, prompt: p, response });
    prompt.performance = analysis ?? null;
    prompt.prev_orders = orders.map((o) => ({
      symbol: o.planned.symbol,
      side: o.planned.side,
      amount: o.planned.quantity,
      datetime: o.created_at,
      status: o.status,
    }));
  } catch (err) {
    log.error({ err }, 'performance analyzer step failed');
    prompt.performance = null;
  }
}
