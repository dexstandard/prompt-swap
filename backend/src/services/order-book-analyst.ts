import { fetchOrderBook } from './derivatives.js';
import { callAi, extractJson } from '../util/ai.js';
import { analysisSchema, type AnalysisLog, type Analysis } from './types.js';

export async function getOrderBookAnalysis(
  pair: string,
  model: string,
  apiKey: string,
): Promise<AnalysisLog> {
  const snapshot = await fetchOrderBook(pair);
  const prompt = { pair, snapshot };
  const body = {
    model,
    input: prompt,
    instructions:
      `You are a crypto market order book analyst. Using the order book snapshot in input, write a short report for a crypto trader about ${pair}. Include a liquidity imbalance score from 0-10.`,
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
  return { analysis: extractJson<Analysis>(res), prompt: body, response: res };
}
