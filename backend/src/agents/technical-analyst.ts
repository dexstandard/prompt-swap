import type { FastifyBaseLogger } from 'fastify';
import { fetchTokenIndicators } from '../services/indicators.js';
import { insertReviewRawLog } from '../repos/agent-review-raw-log.js';
import { callAi, extractJson, type RebalancePrompt } from '../util/ai.js';
import { TOKEN_SYMBOLS, isStablecoin } from '../util/tokens.js';
import { type AnalysisLog, type Analysis, analysisSchema } from './types.js';

export async function getTechnicalOutlook(
  token: string,
  model: string,
  apiKey: string,
  timeframe: string,
  log: FastifyBaseLogger,
): Promise<AnalysisLog> {
  const indicators = await fetchTokenIndicators(token);
  const prompt = { token, timeframe, indicators };
  const instructions = `You are a crypto technical analyst. Using indicators in input, write a short outlook for a crypto trader about ${token} on timeframe ${timeframe}. Include a bullishness score from 0-10 and key signals. - shortReport ≤255 chars.`;
  const fallback: Analysis = { comment: 'Analysis unavailable', score: 0 };
  try {
    const res = await callAi(model, instructions, analysisSchema, prompt, apiKey);
    const analysis = extractJson<Analysis>(res);
    if (!analysis) {
      log.error({ token, response: res }, 'technical analyst returned invalid response');
      return { analysis: fallback, prompt: { instructions, input: prompt }, response: res };
    }
    return { analysis, prompt: { instructions, input: prompt }, response: res };
  } catch (err) {
    log.error({ err, token }, 'technical analyst call failed');
    return { analysis: fallback };
  }
}

export async function runTechnicalAnalyst(
  log: FastifyBaseLogger,
  model: string,
  apiKey: string,
  timeframe: string,
  agentId: string,
  prompt: RebalancePrompt,
): Promise<void> {
  if (!prompt.reports) prompt.reports = [];
  for (const token of TOKEN_SYMBOLS) {
    if (isStablecoin(token)) continue;
    const { analysis, prompt: p, response } = await getTechnicalOutlook(
      token,
      model,
      apiKey,
      timeframe,
      log,
    );
    if (p && response) await insertReviewRawLog({ agentId, prompt: p, response });
    let report = prompt.reports.find((r) => r.token === token);
    if (!report) {
      report = { token, news: null, tech: null, orderbook: null };
      prompt.reports.push(report);
    }
    report.tech = analysis;
  }
}
