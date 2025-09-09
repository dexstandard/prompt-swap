const developerInstructions =
  "You assist a real trader in taking decisions on a given tokens configuration. Users may deposit or withdraw funds between runs; if the current balance doesn't match previous executions, treat the session as new. The user's comment may be found in the trading instructions field. You must determine the target allocation based on current market conditions and the provided portfolio state. Use the web search tool to find fresh news and prices and advise the user whether to rebalance or not. Fit report comment in 255 characters. If you suggest rebalancing, provide the new allocation in percentage (0-100) for the first token in the pair. If you don't suggest rebalancing, set rebalance to false and provide a short report comment. If you encounter an error, return an object with an error message.";

import type { TokenIndicators } from '../services/indicators.js';

export interface MarketTimeseries {
  minute_60: [number, number, number, number][];
  hourly_24h: [number, number, number, number][];
  monthly_24m: [number, number, number][];
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
  config: {
    policy: { floorPercents: Record<string, number> };
    currentStatePortfolio: {
      ts: string;
      positions: RebalancePosition[];
      currentWeights: Record<string, number>;
    };
    previousLimitOrders?: {
      planned: Record<string, unknown>;
      status: string;
    }[];
  };
  marketData: {
    currentPrice: number;
    indicators?: Record<string, TokenIndicators>;
    market_timeseries?: Record<string, MarketTimeseries>;
    fearGreedIndex?: { value: number; classification: string };
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

function compactJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value.trim();
    }
  }
  return JSON.stringify(value);
}

export async function callRebalancingAgent(
  model: string,
  input: RebalancePrompt,
  apiKey: string,
): Promise<string> {
  const body = {
    model,
    input: compactJson(input),
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
