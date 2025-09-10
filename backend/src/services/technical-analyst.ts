import { fetchTokenIndicators } from './indicators.js';
import { callAi, extractJson } from '../util/ai.js';
import { analysisSchema, type Analysis } from './types.js';

export async function getTechnicalOutlook(
  token: string,
  model: string,
  apiKey: string,
  timeframe: string,
): Promise<Analysis | null> {
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
}
