import type { FastifyBaseLogger } from 'fastify';
import { getNewsByToken } from '../repos/news.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import { callAi, extractJson } from '../util/ai.js';
import { TOKEN_SYMBOLS, isStablecoin } from '../util/tokens.js';
import { type AnalysisLog, type Analysis, analysisSchema } from './types.js';

export async function getTokenNewsSummary(
  token: string,
  model: string,
  apiKey: string,
  log: FastifyBaseLogger,
): Promise<AnalysisLog> {
  const items = await getNewsByToken(token, 5);
  if (!items.length) return { analysis: null };
  const headlines = items.map((i) => `- ${i.title} (${i.link})`).join('\n');
  const prompt = { token, headlines };
  const instructions =
    `You are a crypto market news analyst. Using web search and the headlines in input, write a short report for a crypto trader about ${token}. Include a bullishness score from 0-10 and highlight key events.`;
  const fallback: Analysis = { comment: 'Analysis unavailable', score: 0 };
  try {
    const res = await callAi(
      model,
      instructions,
      analysisSchema,
      prompt,
      apiKey,
      true,
    );
    const analysis = extractJson<Analysis>(res);
    if (!analysis) {
      log.error({ token, response: res }, 'news analyst returned invalid response');
      return { analysis: fallback, prompt: { instructions, input: prompt }, response: res };
    }
    return { analysis, prompt: { instructions, input: prompt }, response: res };
  } catch (err) {
    log.error({ err, token }, 'news analyst call failed');
    return { analysis: fallback };
  }
}

export async function runNewsAnalyst(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  agentId: string,
): Promise<Record<string, Analysis | null>> {
  const summaries: Record<string, Analysis | null> = {};
  for (const token of TOKEN_SYMBOLS) {
    if (isStablecoin(token)) continue;
    const { analysis, prompt, response } = await getTokenNewsSummary(
      token,
      model,
      apiKey,
      log,
    );
    if (prompt && response)
      await insertReviewRawLog({ agentId, prompt, response });
    summaries[token] = analysis;
  }
  return summaries;
}
