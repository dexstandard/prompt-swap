import { getNewsByToken } from '../repos/news.js';
import { callAi } from '../util/ai.js';

interface CacheEntry {
  summary?: string;
  expires: number;
  promise?: Promise<string>;
}

const FIVE_MINUTES = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getCacheKey(keyType: string, token: string) {
  return `${keyType}:${token}`;
}

function extractText(res: string): string {
  try {
    const json = JSON.parse(res);
    const outputs = Array.isArray((json as any).output) ? (json as any).output : [];
    const msg = outputs.find((o: any) => o.type === 'message' || o.id?.startsWith('msg_'));
    const text = msg?.content?.[0]?.text;
    return typeof text === 'string' ? text.trim() : '';
  } catch {
    return '';
  }
}

export async function getTokenNewsSummary(
  token: string,
  model: string,
  apiKey: string,
  keyType = 'openai',
): Promise<string> {
  const now = Date.now();
  const cacheKey = getCacheKey(keyType, token);
  const existing = cache.get(cacheKey);
  if (existing) {
    if (existing.summary && existing.expires > now) return existing.summary;
    if (existing.promise) return existing.promise;
  }
  const promise = (async () => {
    const items = await getNewsByToken(token, 10);
    if (!items.length) return '';
    const headlines = items
      .map((i) => `- ${i.title} (${i.link})`)
      .join('\n');
    const body = {
      model,
      input: `You are a crypto market news analyst. Using web search and the headlines below, write a short report for a crypto trader about ${token}. Include a bullishness score from 0-10 and highlight key events:\n${headlines}`,
      tools: [{ type: 'web_search_preview' }],
      text: { max_output_tokens: 255 },
    };
    const res = await callAi(body, apiKey);
    return extractText(res);
  })();
  cache.set(cacheKey, { promise, expires: now + FIVE_MINUTES });
  try {
    const summary = await promise;
    cache.set(cacheKey, { summary, expires: Date.now() + FIVE_MINUTES });
    return summary;
  } catch (err) {
    cache.delete(cacheKey);
    throw err;
  }
}
