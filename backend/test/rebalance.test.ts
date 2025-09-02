import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { getLimitOrders } from './repos/limit-orders.js';
import { insertUser } from './repos/users.js';
import { insertAgent } from './repos/agents.js';
import { insertReviewResult } from './repos/agent-review-result.js';

vi.mock('../src/services/binance.js', () => ({
  fetchPairData: vi.fn().mockResolvedValue({ currentPrice: 100 }),
  createLimitOrder: vi.fn().mockResolvedValue({ orderId: 1 }),
}));

import { createRebalanceLimitOrder } from '../src/services/rebalance.js';
import { createLimitOrder } from '../src/services/binance.js';

describe('createRebalanceLimitOrder', () => {
  it('saves execution with status and exec result', async () => {
    const log = { info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    const userId = await insertUser('1');
    const agent = await insertAgent({
      userId,
      model: 'm',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokenA: 'BTC',
      tokenB: 'ETH',
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const reviewResultId = await insertReviewResult({ agentId: agent.id, log: '' });
    await createRebalanceLimitOrder({
      userId,
      tokenA: 'BTC',
      tokenB: 'ETH',
      positions: [
        { sym: 'BTC', value_usdt: 50 },
        { sym: 'ETH', value_usdt: 150 },
      ],
      newAllocation: 50,
      log,
      reviewResultId,
    });

    const row = (await getLimitOrders())[0];

    expect(row.user_id).toBe(userId);
    expect(JSON.parse(row.planned_json)).toMatchObject({
      symbol: 'BTCETH',
      side: 'BUY',
      quantity: 0.5,
      price: 100,
    });
    expect(row.status).toBe('open');
    expect(row.review_result_id).toBe(reviewResultId);
    expect(row.order_id).toBe('1');
    expect(createLimitOrder).toHaveBeenCalledWith(userId, {
      symbol: 'BTCETH',
      side: 'BUY',
      quantity: 0.5,
      price: 100,
    });
  });
});
