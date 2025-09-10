import { getNewsByToken } from '../repos/news.js';
import { callAi, extractJson } from '../util/ai.js';
import { analysisSchema, type Analysis } from './types.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';

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


export async function getTokenNewsSummary(
  token: string,
  model: string,
  apiKey: string,
  opts?: { keyType?: string; agentId?: string },
): Promise<Analysis | null> {
  const { keyType = 'openai', agentId } = opts ?? {};
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
    if (agentId)
      await insertReviewRawLog({ agentId, prompt: body, response: res });
    return extractJson<Analysis>(res);
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
