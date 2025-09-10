import type { FastifyBaseLogger } from 'fastify';
import { fetchTokenIndicators } from './indicators.js';
import { callAi, extractJson, compactJson } from '../util/ai.js';
import { analysisSchema, type AnalysisLog, type Analysis } from './types.js';

export async function getTechnicalOutlook(
  token: string,
  model: string,
  apiKey: string,
  timeframe: string,
  log: FastifyBaseLogger,
): Promise<AnalysisLog> {
  const indicators = await fetchTokenIndicators(token);
  const prompt = { token, timeframe, indicators };
  const body = {
    model,
    input: compactJson(prompt),
    instructions:
        `You are a crypto technical analyst. Using indicators in input, write a short outlook for a crypto trader about ${token} on timeframe ${timeframe}. Include a bullishness score from 0-10 and key signals.`,
    max_output_tokens: 255,
    text: {
      format: {
        type: 'json_schema',
        name: 'analysis',
        strict: true,
        schema: analysisSchema,
      },
    },
  };
  const fallback: Analysis = { comment: 'Analysis unavailable', score: 0 };
  try {
    const res = await callAi(body, apiKey);
    const analysis = extractJson<Analysis>(res);
    if (!analysis) {
      log.error({ token, res }, 'technical analyst returned invalid response');
      return { analysis: fallback, prompt: body, response: res };
    }
    return { analysis, prompt: body, response: res };
  } catch (err) {
    log.error({ err, token }, 'technical analyst call failed');
    return { analysis: fallback };
  }
}
