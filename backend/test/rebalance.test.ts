import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { getLimitOrders } from './repos/limit-orders.js';
import { insertUser } from './repos/users.js';
import { insertAgent } from './repos/agents.js';
import { insertReviewResult } from './repos/agent-review-result.js';
import { db } from '../src/db/index.js';

vi.mock('../src/services/binance.js', () => ({
  fetchPairData: vi.fn().mockResolvedValue({
    symbol: 'BTCUSDT',
    currentPrice: 100,
    stepSize: 0.001,
  }),
  createLimitOrder: vi.fn().mockResolvedValue({ orderId: 1 }),
}));

import { createRebalanceLimitOrder } from '../src/services/rebalance.js';
import { createLimitOrder, fetchPairData } from '../src/services/binance.js';

describe('createRebalanceLimitOrder', () => {
  beforeEach(async () => {
    await db.query('TRUNCATE limit_order RESTART IDENTITY CASCADE');
  });
  it('saves execution with status and exec result', async () => {
    const log = { info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    const userId = await insertUser('1');
    const agent = await insertAgent({
      userId,
      model: 'm',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'USDT', minAllocation: 10 },
        { token: 'BTC', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const reviewResultId = await insertReviewResult({ agentId: agent.id, log: '' });
    await createRebalanceLimitOrder({
      userId,
      tokens: ['USDT', 'BTC'],
      positions: [
        { sym: 'USDT', value_usdt: 150 },
        { sym: 'BTC', value_usdt: 50 },
      ],
      newAllocation: 50,
      log,
      reviewResultId,
    });

    const row = (await getLimitOrders())[0];

    expect(row.user_id).toBe(userId);
    expect(JSON.parse(row.planned_json)).toMatchObject({
      symbol: 'BTCUSDT',
      side: 'BUY',
      quantity: 0.5,
      price: 99.9,
      manuallyEdited: false,
    });
    expect(row.status).toBe('open');
    expect(row.review_result_id).toBe(reviewResultId);
    expect(row.order_id).toBe('1');
    expect(createLimitOrder).toHaveBeenCalledWith(userId, {
      symbol: 'BTCUSDT',
      side: 'BUY',
      quantity: 0.5,
      price: 99.9,
    });
  });

  it('allows manual overrides and sets flag', async () => {
    const log = { info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    const userId = await insertUser('2');
    const agent = await insertAgent({
      userId,
      model: 'm',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'USDT', minAllocation: 10 },
        { token: 'BTC', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const reviewResultId = await insertReviewResult({ agentId: agent.id, log: '' });
    await createRebalanceLimitOrder({
      userId,
      tokens: ['USDT', 'BTC'],
      positions: [
        { sym: 'USDT', value_usdt: 150 },
        { sym: 'BTC', value_usdt: 50 },
      ],
      newAllocation: 50,
      log,
      reviewResultId,
      price: 120,
      quantity: 0.3,
      manuallyEdited: true,
    });
    const row = (await getLimitOrders())[0];
    expect(JSON.parse(row.planned_json)).toMatchObject({
      symbol: 'BTCUSDT',
      side: 'BUY',
      quantity: 0.3,
      price: 120,
      manuallyEdited: true,
    });
  });

  it('skips orders below minimum value', async () => {
    const log = { info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    const userId = await insertUser('3');
    const agent = await insertAgent({
      userId,
      model: 'm',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'USDT', minAllocation: 10 },
        { token: 'BTC', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const reviewResultId = await insertReviewResult({ agentId: agent.id, log: '' });
    vi.mocked(createLimitOrder).mockClear();
    await createRebalanceLimitOrder({
      userId,
      tokens: ['USDT', 'BTC'],
      positions: [
        { sym: 'USDT', value_usdt: 100 },
        { sym: 'BTC', value_usdt: 99.99 },
      ],
      newAllocation: 50,
      log,
      reviewResultId,
    });
    const rows = await getLimitOrders();
    expect(rows).toHaveLength(0);
    expect(createLimitOrder).not.toHaveBeenCalled();
  });

  it('rounds quantity down to step size precision', async () => {
    const log = { info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    const userId = await insertUser('4');
    const agent = await insertAgent({
      userId,
      model: 'm',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'USDT', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const reviewResultId = await insertReviewResult({ agentId: agent.id, log: '' });
    vi.mocked(fetchPairData).mockResolvedValueOnce({
      symbol: 'BTCUSDT',
      currentPrice: 1,
      stepSize: 0.01,
    } as any);
    await createRebalanceLimitOrder({
      userId,
      tokens: ['BTC', 'USDT'],
      positions: [
        { sym: 'BTC', value_usdt: 0 },
        { sym: 'USDT', value_usdt: 100.555 },
      ],
      newAllocation: 50,
      log,
      reviewResultId,
    });
    const row = (await getLimitOrders())[0];
    expect(JSON.parse(row.planned_json)).toMatchObject({ quantity: 50.27 });
    expect(createLimitOrder).toHaveBeenCalledWith(userId, expect.objectContaining({ quantity: 50.27 }));
  });

  it('throws if step size is missing', async () => {
    const log = { info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    const userId = await insertUser('5');
    const agent = await insertAgent({
      userId,
      model: 'm',
      status: 'active',
      startBalance: null,
      name: 'A',
      tokens: [
        { token: 'USDT', minAllocation: 10 },
        { token: 'BTC', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    const reviewResultId = await insertReviewResult({ agentId: agent.id, log: '' });
    vi.mocked(fetchPairData).mockResolvedValueOnce({
      symbol: 'BTCUSDT',
      currentPrice: 1,
    } as any);
    await expect(
      createRebalanceLimitOrder({
        userId,
        tokens: ['USDT', 'BTC'],
        positions: [
          { sym: 'USDT', value_usdt: 150 },
          { sym: 'BTC', value_usdt: 50 },
        ],
        newAllocation: 50,
        log,
        reviewResultId,
      }),
    ).rejects.toThrow(/step size/);
  });
});
