const developerInstructions = [
  '- You lead a crypto analyst team (news, technical, order-book). Reports from each member are attached.',
  '- Know every team member, their role, and ensure decisions follow the overall trading strategy.',
  '- Decide whether to rebalance based on portfolio, market data, and analyst reports.',
  '- If rebalancing, return {rebalance:true,newAllocation:0-100 for first token,shortReport}.',
  '- If not, return {rebalance:false,shortReport}.',
  '- shortReport ≤255 chars.',
  '- On error, return {error:"message"}.',
].join('\n');

export interface TokenMetrics {
  ret_1h: number;
  ret_4h: number;
  ret_24h: number;
  ret_7d: number;
  ret_30d: number;
  sma_dist_20: number;
  sma_dist_50: number;
  sma_dist_200: number;
  macd_hist: number;
  vol_rv_7d: number;
  vol_rv_30d: number;
  vol_atr_pct: number;
  range_bb_bw: number;
  range_donchian20: number;
  volume_z_1h: number;
  volume_z_24h: number;
  corr_BTC_30d: number;
  regime_BTC: string;
}

export interface MarketTimeseries {
  ret_60m: number;
  ret_24h: number;
  ret_24m: number;
}

export interface RebalancePosition {
  sym: string;
  qty: number;
  price_usdt: number;
  value_usdt: number;
}

export interface PreviousResponse {
  rebalance?: boolean;
  newAllocation?: number;
  shortReport?: string;
  error?: unknown;
}

export interface RebalancePrompt {
  instructions: string;
  policy: { floor: Record<string, number> };
  portfolio: {
    ts: string;
    positions: RebalancePosition[];
  };
  /**
   * Summary of recent limit orders placed by the agent. Only essential
   * attributes are included to minimize token usage in the prompt.
   */
  prev_orders?: {
    symbol: string;
    side: string;
    amount: number;
    datetime: string;
    status: string;
  }[];
  marketData: {
    currentPrice: number;
    indicators?: Record<string, TokenMetrics>;
    market_timeseries?: Record<string, MarketTimeseries>;
    fearGreedIndex?: { value: number; classification: string };
    openInterest?: number;
    fundingRate?: number;
    orderBook?: { bid: [number, number]; ask: [number, number] };
    /**
     * News analyst report for each token.
     */
    newsReports?: Record<string, string>;
  };
  previous_responses?: PreviousResponse[];
}

const rebalanceResponseSchema = {
    type: 'object',
    properties: {
      result: {
        anyOf: [
          {
            type: 'object',
            properties: {
              rebalance: { type: 'boolean', const: false },
              shortReport: { type: 'string' },
            },
            required: ['rebalance', 'shortReport'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              rebalance: { type: 'boolean', const: true },
              newAllocation: { type: 'number' },
              shortReport: { type: 'string' },
            },
            required: ['rebalance', 'newAllocation', 'shortReport'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
            required: ['error'],
            additionalProperties: false,
          },
        ],
      },
    },
    required: ['result'],
    additionalProperties: false,
  };

export async function callAi(body: unknown, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: compactJson(body),
  });
  return await res.text();
}

export function compactJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value.trim();
    }
  }
  return JSON.stringify(value);
}

export async function callTraderAgent(
  model: string,
  input: unknown,
  apiKey: string,
): Promise<string> {
  const body = {
    model,
    input,
    instructions: developerInstructions,
    tools: [{ type: 'web_search_preview' }],
    text: {
      format: {
        type: 'json_schema',
        name: 'rebalance_response',
        strict: true,
        schema: rebalanceResponseSchema,
      },
    },
  };
  return callAi(body, apiKey);
}
