import { getNewsByToken } from '../repos/news.js';
import { callAi } from '../util/ai.js';
import { analysisSchema, type Analysis } from './types.js';

interface CacheEntry {
  summary?: Analysis;
  expires: number;
  promise?: Promise<Analysis | null>;
}

const THREE_MINUTES = 3 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getCacheKey(keyType: string, token: string) {
  return `${keyType}:${token}`;
}

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

export async function getTokenNewsSummary(
  token: string,
  model: string,
  apiKey: string,
  keyType = 'openai',
): Promise<Analysis | null> {
  const now = Date.now();
  const cacheKey = getCacheKey(keyType, token);
  const existing = cache.get(cacheKey);
  if (existing) {
      if (existing.summary && existing.expires > now) return existing.summary;
      if (existing.promise) return existing.promise;
  }
  const promise = (async () => {
    const items = await getNewsByToken(token, 5);
    if (!items.length) return null;
    const headlines = items.map((i) => `- ${i.title} (${i.link})`).join('\n');
    const prompt = { token, headlines };
    const body = {
      model,
      input: prompt,
      instructions:
        `You are a crypto market news analyst. Using web search and the headlines in input, write a short report for a crypto trader about ${token}. Include a bullishness score from 0-10 and highlight key events.`,
      tools: [{ type: 'web_search_preview' }],
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
  })();
  cache.set(cacheKey, { promise, expires: now + THREE_MINUTES });
  try {
    const summary = await promise;
    if (summary) cache.set(cacheKey, { summary, expires: Date.now() + THREE_MINUTES });
    else cache.delete(cacheKey);
    return summary;
  } catch (err) {
    cache.delete(cacheKey);
    throw err;
  }
}
