import { callAi } from '../util/ai.js';
import { analysisSchema, type Analysis } from './types.js';

function extractJson(res: string): Analysis | null {
  try {
    const json = JSON.parse(res);
    const outputs = Array.isArray((json as any).output) ? (json as any).output : [];
    const msg = outputs.find((o: any) => o.type === 'message' || o.id?.startsWith('msg_'));
    const text = msg?.content?.[0]?.text;
    if (typeof text !== 'string') return null;
    return JSON.parse(text) as Analysis;
  } catch {
    return null;
  }
}

export async function getPerformanceAnalysis(
  input: unknown,
  model: string,
  apiKey: string,
): Promise<Analysis | null> {
  const reports = Array.isArray((input as any)?.reports)
    ? (input as any).reports
    : [];
  const orders = Array.isArray((input as any)?.orders)
    ? (input as any).orders
    : [];
  if (reports.length === 0 && orders.length === 0) return null;
  const body = {
    model,
    input,
    instructions:
      'You are a performance analyst. Review the provided analyst reports and recent order outcomes to evaluate how well the trading team performed. Return a brief comment and a performance score from 0-10.',
    text: {
      max_output_tokens: 255,
      format: {
        type: 'json_schema',
        name: 'analysis',
        strict: true,
        schema: analysisSchema,
      },
    },
  };
  const res = await callAi(body, apiKey);
  return extractJson(res);
}
