import type { FastifyBaseLogger } from 'fastify';
import { fetchOrderBook } from './derivatives.js';
import { callAi, extractJson, compactJson } from '../util/ai.js';
import { analysisSchema, type AnalysisLog, type Analysis } from './types.js';

export async function getOrderBookAnalysis(
  pair: string,
  model: string,
  apiKey: string,
  log: FastifyBaseLogger,
): Promise<AnalysisLog> {
  const snapshot = await fetchOrderBook(pair);
  const prompt = { pair, snapshot };
  const body = {
    model,
    input: compactJson(prompt),
    instructions:
      `You are a crypto market order book analyst. Using the order book snapshot in input, write a short report for a crypto trader about ${pair}. Include a liquidity imbalance score from 0-10.`,
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
    const analysis = extractJson<Analysis>(res);
    if (!analysis) {
      log.error({ pair, response: res }, 'order book analyst returned invalid response');
      return { analysis: fallback, prompt: body, response: res };
    }
    return { analysis, prompt: body, response: res };
  } catch (err) {
    log.error({ err, pair }, 'order book analyst call failed');
    return { analysis: fallback };
  }
}
