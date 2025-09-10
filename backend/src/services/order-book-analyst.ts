import { callAi } from '../util/ai.js';

export interface Analysis {
  /** recommended action: buy, sell, or hold */
  action: string;
  /** confidence level 0-1 or 0-100 depending on model */
  confidence: number;
  /** short textual summary */
  summary: string;
}

function extractJson<T>(res: string): T {
  try {
    const json = JSON.parse(res);
    const outputs = Array.isArray((json as any).output) ? (json as any).output : [];
    const msg = outputs.find((o: any) => o.type === 'message' || o.id?.startsWith('msg_'));
    const text = msg?.content?.[0]?.text;
    if (typeof text === 'string') {
      return JSON.parse(text) as T;
    }
  } catch {
    /* ignore */
  }
  return {} as T;
}

export async function analyzeOrderBook(
  model: string,
  orderBook: unknown,
  apiKey: string,
): Promise<Analysis> {
  const body = {
    model,
    input: `You are a crypto market analyst. Given the order book data below, return JSON {"action":"buy|sell|hold","confidence":number,"summary":string}.\n` +
      JSON.stringify(orderBook),
    text: { max_output_tokens: 255 },
  };
  const res = await callAi(body, apiKey);
  return extractJson<Analysis>(res);
}
