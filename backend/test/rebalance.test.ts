import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { clearExecutions, getExecutions } from './repos/executions.js';

vi.mock('../src/services/binance.js', () => ({
  fetchPairData: vi.fn().mockResolvedValue({ currentPrice: 100 }),
  createLimitOrder: vi.fn().mockResolvedValue(undefined),
}));

import { createRebalanceLimitOrder } from '../src/services/rebalance.js';
import { createLimitOrder } from '../src/services/binance.js';

describe('createRebalanceLimitOrder', () => {
  it('saves execution with status and exec result', async () => {
    const log = { info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    clearExecutions();
    await createRebalanceLimitOrder({
      userId: 'user1',
      tokenA: 'BTC',
      tokenB: 'ETH',
      positions: [
        { sym: 'BTC', value_usdt: 50 },
        { sym: 'ETH', value_usdt: 150 },
      ],
      newAllocation: 50,
      log,
      execResultId: 'res1',
    });

    const row = getExecutions()[0];

    expect(row.user_id).toBe('user1');
    expect(JSON.parse(row.planned_json)).toMatchObject({
      symbol: 'BTCETH',
      side: 'BUY',
      quantity: 0.5,
      price: 100,
    });
    expect(row.status).toBe('pending');
    expect(row.exec_result_id).toBe('res1');
    expect(createLimitOrder).toHaveBeenCalledWith('user1', {
      symbol: 'BTCETH',
      side: 'BUY',
      quantity: 0.5,
      price: 100,
    });
  });
});
