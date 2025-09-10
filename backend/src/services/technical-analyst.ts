import { fetchTokenIndicators } from './indicators.js';
import { callAi, extractJson } from '../util/ai.js';
import { analysisSchema, type Analysis } from './types.js';

interface CacheEntry {
  outlook?: Analysis;
  expires: number;
  promise?: Promise<Analysis | null>;
}

const ONE_MINUTE = 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getCacheKey(keyType: string, token: string, timeframe: string) {
  return `${keyType}:${token}:${timeframe}`;
}

export async function getTechnicalOutlook(
  token: string,
  model: string,
  apiKey: string,
  timeframe: string,
  keyType = 'openai',
): Promise<Analysis | null> {
  const now = Date.now();
  const cacheKey = getCacheKey(keyType, token, timeframe);
  const existing = cache.get(cacheKey);
  if (existing) {
    if (existing.outlook && existing.expires > now) return existing.outlook;
    if (existing.promise) return existing.promise;
  }
  const promise = (async () => {
    const indicators = await fetchTokenIndicators(token);
    const prompt = { token, timeframe, indicators };
    const body = {
      model,
      input: prompt,
      instructions:
        `You are a crypto technical analyst. Using indicators in input, write a short outlook for a crypto trader about ${token} on timeframe ${timeframe}. Include a bullishness score from 0-10 and key signals.`,
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
    return extractJson<Analysis>(res);
  })();
  cache.set(cacheKey, { promise, expires: now + ONE_MINUTE });
  try {
    const outlook = await promise;
    if (outlook) cache.set(cacheKey, { outlook, expires: Date.now() + ONE_MINUTE });
    else cache.delete(cacheKey);
    return outlook;
  } catch (err) {
    cache.delete(cacheKey);
    throw err;
  }
}
