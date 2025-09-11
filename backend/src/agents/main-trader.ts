import type { FastifyBaseLogger } from 'fastify';
import {
  callAi,
  developerInstructions,
  rebalanceResponseSchema,
  type RebalancePosition,
  type PreviousResponse,
  type RebalancePrompt,
  extractJson,
} from '../util/ai.js';
import { isStablecoin } from '../util/tokens.js';
import { fetchAccount, fetchPairData } from '../services/binance.js';
import { getRecentReviewResults } from '../repos/agent-review-result.js';
import type { ActivePortfolioWorkflowRow } from '../repos/portfolio-workflow.js';
import type { RunParams } from './types.js';

function computePortfolioValues(
  row: ActivePortfolioWorkflowRow,
  balances: { token1Balance: number; token2Balance: number },
  price1: number,
  price2: number,
) {
  const token1 = row.tokens[0].token;
  const token2 = row.tokens[1].token;
  const min1 = row.tokens[0].min_allocation;
  const min2 = row.tokens[1].min_allocation;
  const value1 = balances.token1Balance * price1;
  const value2 = balances.token2Balance * price2;
  const floor: Record<string, number> = {
    [token1]: min1,
    [token2]: min2,
  };
  const positions: RebalancePosition[] = [
    {
      sym: token1,
      qty: balances.token1Balance,
      price_usdt: price1,
      value_usdt: value1,
    },
    {
      sym: token2,
      qty: balances.token2Balance,
      price_usdt: price2,
      value_usdt: value2,
    },
  ];
  return { floor, positions };
}

function extractPreviousResponse(r: any): PreviousResponse | undefined {
  const res: PreviousResponse = {};
  if (typeof r.rebalance === 'boolean') res.rebalance = r.rebalance;
  if (typeof r.newAllocation === 'number') res.newAllocation = r.newAllocation;
  if (typeof r.shortReport === 'string') res.shortReport = r.shortReport;
  if (r.error !== undefined && r.error !== null) res.error = r.error;
  return Object.keys(res).length ? res : undefined;
}

export async function collectPromptData(
  row: ActivePortfolioWorkflowRow,
  log: FastifyBaseLogger,
): Promise<RebalancePrompt | undefined> {
  const token1 = row.tokens[0].token;
  const token2 = row.tokens[1].token;
  let token1Balance: number | undefined;
  let token2Balance: number | undefined;
  try {
    const account = await fetchAccount(row.user_id);
    if (account) {
      const bal1 = account.balances.find((b) => b.asset === token1);
      if (bal1) token1Balance = Number(bal1.free) + Number(bal1.locked);
      const bal2 = account.balances.find((b) => b.asset === token2);
      if (bal2) token2Balance = Number(bal2.free) + Number(bal2.locked);
    }
  } catch (err) {
    log.error({ err }, 'failed to fetch balance');
  }
  if (token1Balance === undefined || token2Balance === undefined) {
    log.error('failed to fetch token balances');
    return undefined;
  }

  const [pair, price1Data, price2Data] = await Promise.all([
    fetchPairData(token1, token2),
    token1 === 'USDT' || token1 === 'USDC'
      ? Promise.resolve({ currentPrice: 1 })
      : fetchPairData(token1, 'USDT'),
    token2 === 'USDT' || token2 === 'USDC'
      ? Promise.resolve({ currentPrice: 1 })
      : fetchPairData(token2, 'USDT'),
  ]);

  const { floor, positions } = computePortfolioValues(
    row,
    { token1Balance, token2Balance },
    price1Data.currentPrice,
    price2Data.currentPrice,
  );

  const prevRows = await getRecentReviewResults(row.id, 5);
  const previousResponses = prevRows
    .map(extractPreviousResponse)
    .filter(Boolean) as PreviousResponse[];

  const prompt: RebalancePrompt = {
    instructions: row.agent_instructions,
    policy: { floor },
    portfolio: { ts: new Date().toISOString(), positions },
    marketData: { currentPrice: pair.currentPrice },
    reports: row.tokens
      .map((t) => t.token)
      .filter((t) => !isStablecoin(t))
      .map((token) => ({ token, news: null, tech: null })),
  };
  if (previousResponses.length) {
    prompt.previous_responses = previousResponses;
  }
  return prompt;
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
  { log, model, apiKey }: RunParams,
  prompt: RebalancePrompt,
): Promise<MainTraderDecision | null> {
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

