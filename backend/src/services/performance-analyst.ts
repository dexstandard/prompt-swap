import type { FastifyBaseLogger } from 'fastify';
import { callAi, extractJson } from '../util/ai.js';
import { type AnalysisLog, type Analysis, analysisSchema } from './types.js';

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
    'You are a performance analyst. Review the provided analyst reports and recent order outcomes to evaluate how well the trading team performed. Return a brief comment and a performance score from 0-10. - shortReport ≤255 chars.';
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
