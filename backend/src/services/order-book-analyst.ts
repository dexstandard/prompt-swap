import type { FastifyBaseLogger } from 'fastify';
import { fetchOrderBook } from './derivatives.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import { callAi, extractJson } from '../util/ai.js';
import { TOKEN_SYMBOLS, isStablecoin } from '../util/tokens.js';
import { type AnalysisLog, type Analysis, analysisSchema } from './types.js';

export async function getOrderBookAnalysis(
  pair: string,
  model: string,
  apiKey: string,
  log: FastifyBaseLogger,
): Promise<AnalysisLog> {
  const snapshot = await fetchOrderBook(pair);
  const prompt = { pair, snapshot };
  const instructions =
    `You are a crypto market order book analyst. Using the order book snapshot in input, write a short report for a crypto trader about ${pair}. Include a liquidity imbalance score from 0-10.`;
  const fallback: Analysis = { comment: 'Analysis unavailable', score: 0 };
  try {
    const res = await callAi(model, instructions, analysisSchema, prompt, apiKey);
    const analysis = extractJson<Analysis>(res);
    if (!analysis) {
      log.error({ pair, response: res }, 'order book analyst returned invalid response');
      return { analysis: fallback, prompt: { instructions, input: prompt }, response: res };
    }
    return { analysis, prompt: { instructions, input: prompt }, response: res };
  } catch (err) {
    log.error({ err, pair }, 'order book analyst call failed');
    return { analysis: fallback };
  }
}

export async function runOrderBookAnalyst(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  agentId: string,
): Promise<Record<string, Analysis | null>> {
  const books: Record<string, Analysis | null> = {};
  for (const token of TOKEN_SYMBOLS) {
    if (isStablecoin(token)) continue;
    const pair = `${token}USDT`;
    const { analysis, prompt, response } = await getOrderBookAnalysis(
      pair,
      model,
      apiKey,
      log,
    );
    if (prompt && response)
      await insertReviewRawLog({ agentId, prompt, response });
    books[token] = analysis;
  }
  return books;
}
