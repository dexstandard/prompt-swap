import { callAi, extractJson, compactJson } from '../util/ai.js';
import { analysisSchema, type AnalysisLog, type Analysis } from './types.js';

export async function getPerformanceAnalysis(
  input: unknown,
  model: string,
  apiKey: string,
): Promise<AnalysisLog> {
  const reports = Array.isArray((input as any)?.reports)
    ? (input as any).reports
    : [];
  const orders = Array.isArray((input as any)?.orders)
    ? (input as any).orders
    : [];
  if (reports.length === 0 && orders.length === 0) return { analysis: null };
  const body = {
    model,
    input: compactJson(input),
    instructions:
        'You are a performance analyst. Review the provided analyst reports and recent order outcomes to evaluate how well the trading team performed. Return a brief comment and a performance score from 0-10.',
    max_output_tokens: 255,
    text: {
      format: {
        type: 'json_schema',
        name: 'analysis',
        strict: true,
        schema: analysisSchema,
      },
    },
  };
  const fallback: Analysis = { comment: 'Analysis unavailable', score: 0 };
  try {
    const res = await callAi(body, apiKey);
    const analysis = extractJson<Analysis>(res) ?? fallback;
    return { analysis, prompt: body, response: res };
  } catch {
    return { analysis: fallback };
  }
}
