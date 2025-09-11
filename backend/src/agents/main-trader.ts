import type { FastifyBaseLogger } from 'fastify';
import { runNewsAnalyst } from './news-analyst.js';
import { runTechnicalAnalyst } from './technical-analyst.js';
import { runOrderBookAnalyst } from './order-book-analyst.js';
import { runPerformanceAnalyzer } from './performance-analyst.js';
import {
  callAi,
  developerInstructions,
  rebalanceResponseSchema,
  type RebalancePosition,
  type PreviousResponse,
  type RebalancePrompt,
} from '../util/ai.js';
import { TOKEN_SYMBOLS } from '../util/tokens.js';

export interface PreparePromptParams {
  instructions: string;
  floor: Record<string, number>;
  positions: RebalancePosition[];
  currentPrice: number;
  previousResponses?: PreviousResponse[];
}

export function preparePrompt({
  instructions,
  floor,
  positions,
  currentPrice,
  previousResponses,
}: PreparePromptParams): RebalancePrompt {
  const prompt: RebalancePrompt = {
    instructions,
    policy: { floor },
    portfolio: { ts: new Date().toISOString(), positions },
    marketData: { currentPrice },
    reports: TOKEN_SYMBOLS.map((token) => ({
      token,
      news: null,
      tech: null,
      orderbook: null,
    })),
  };
  if (previousResponses && previousResponses.length) {
    prompt.previous_responses = previousResponses;
  }
  return prompt;
}

export interface RunParams {
  log: FastifyBaseLogger;
  model: string;
  apiKey: string;
  timeframe: string;
  agentId: string;
}

export interface MainTraderDecision {
  rebalance: boolean;
  newAllocation?: number;
  shortReport: string;
}

function extractResult(res: string): MainTraderDecision | null {
  try {
    const json = JSON.parse(res);
    const outputs = Array.isArray((json as any).output) ? (json as any).output : [];
    const msg = outputs.find((o: any) => o.type === 'message' || o.id?.startsWith('msg_'));
    const text = msg?.content?.[0]?.text;
    if (typeof text !== 'string') return null;
    const parsed = JSON.parse(text);
    return parsed.result ?? null;
  } catch {
    return null;
  }
}

export async function run(
  { log, model, apiKey, timeframe, agentId }: RunParams,
  prompt: RebalancePrompt,
): Promise<MainTraderDecision | null> {
  await Promise.all([
    runNewsAnalyst(log, model, apiKey, agentId, prompt),
    runTechnicalAnalyst(log, model, apiKey, timeframe, agentId, prompt),
    runOrderBookAnalyst(log, model, apiKey, agentId, prompt),
  ]);
  await runPerformanceAnalyzer(log, model, apiKey, agentId, prompt);
  const res = await callAi(
    model,
    developerInstructions,
    rebalanceResponseSchema,
    prompt,
    apiKey,
    true,
  );
  const decision = extractResult(res);
  if (!decision) {
    log.error('main trader returned invalid response');
    return null;
  }
  return decision;
}

