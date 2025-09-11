import type { FastifyBaseLogger } from 'fastify';
import { getNewsByToken } from '../repos/news.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import { callAi, extractJson, type RebalancePrompt } from '../util/ai.js';
import { TOKEN_SYMBOLS, isStablecoin } from '../util/tokens.js';
import { type AnalysisLog, type Analysis, analysisSchema, type RunParams } from './types.js';

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
    `You are a crypto market news analyst. Using web search and the headlines in input, write a short report for a crypto trader about ${token}. Include a bullishness score from 0-10 and highlight key events. - shortReport ≤255 chars.`;
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
  { log, model, apiKey, portfolioId }: RunParams,
  prompt: RebalancePrompt,
): Promise<void> {
  if (!prompt.reports) prompt.reports = [];
  for (const token of TOKEN_SYMBOLS) {
    if (isStablecoin(token)) continue;
    const { analysis, prompt: p, response } = await getTokenNewsSummary(
      token,
      model,
      apiKey,
      log,
    );
    if (p && response)
      await insertReviewRawLog({ portfolioId, prompt: p, response });
    let report = prompt.reports.find((r) => r.token === token);
    if (!report) {
      report = { token, news: null, tech: null, orderbook: null };
      prompt.reports.push(report);
    }
    report.news = analysis;
  }
}
