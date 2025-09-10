import { fetchOrderBook } from './derivatives.js';
import { callAi, extractJson } from '../util/ai.js';
import { analysisSchema, type Analysis } from './types.js';
import { setCache, getCache, acquireLock, releaseLock } from '../util/cache.js';

export async function getOrderBookAnalysis(
  pair: string,
  model: string,
  apiKey: string,
): Promise<Analysis | null> {
  const key = `orderbook:${model}:${pair}`;
  const cached = await getCache<Analysis>(key);
  if (cached) return cached;
  if (!acquireLock(key)) return null;
  try {
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
    const analysis = extractJson<Analysis>(res);
    if (analysis) await setCache(key, analysis, 60 * 1000);
    return analysis;
  } finally {
    releaseLock(key);
  }
}
