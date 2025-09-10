import { getNewsByToken } from '../repos/news.js';
import { callAi, extractJson, compactJson } from '../util/ai.js';
import { analysisSchema, type AnalysisLog, type Analysis } from './types.js';

export async function getTokenNewsSummary(
  token: string,
  model: string,
  apiKey: string,
): Promise<AnalysisLog> {
  const items = await getNewsByToken(token, 5);
  if (!items.length) return { analysis: null };
  const headlines = items.map((i) => `- ${i.title} (${i.link})`).join('\n');
  const prompt = { token, headlines };
  const body = {
    model,
    input: compactJson(prompt),
    instructions:
      `You are a crypto market news analyst. Using web search and the headlines in input, write a short report for a crypto trader about ${token}. Include a bullishness score from 0-10 and highlight key events.`,
    tools: [{ type: 'web_search_preview' }],
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
  const res = await callAi(body, apiKey);
  const analysis = extractJson<Analysis>(res);
  if (!analysis) throw new Error('missing news analysis');
  return { analysis, prompt: body, response: res };
}
