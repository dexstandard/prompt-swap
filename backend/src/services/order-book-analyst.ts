import { fetchOrderBook } from './derivatives.js';
import { callAi, extractJson } from '../util/ai.js';
import { analysisSchema, type Analysis } from './types.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';

interface CacheEntry {
  summary?: Analysis;
  expires: number;
  promise?: Promise<Analysis | null>;
}

const ONE_MINUTE = 60 * 1000;
const cache = new Map<string, CacheEntry>();

export async function getOrderBookAnalysis(
  pair: string,
  model: string,
  apiKey: string,
  agentId?: string,
): Promise<Analysis | null> {
  const now = Date.now();
  const key = `${model}:${pair}`;
  const existing = cache.get(key);
  if (existing) {
    if (existing.summary && existing.expires > now) return existing.summary;
    if (existing.promise) return existing.promise;
  }

  const promise = (async () => {
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
    if (agentId)
      await insertReviewRawLog({ agentId, prompt: body, response: res });
    return extractJson<Analysis>(res);
  })();

  cache.set(key, { promise, expires: now + ONE_MINUTE });

  try {
    const summary = await promise;
    if (summary) {
      cache.set(key, { summary, expires: Date.now() + ONE_MINUTE });
    } else {
      cache.delete(key);
    }
    return summary;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}
