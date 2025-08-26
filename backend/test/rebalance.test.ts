import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/services/binance.js', () => ({
  fetchPairData: vi.fn().mockResolvedValue({ currentPrice: 100 }),
  createLimitOrder: vi.fn().mockResolvedValue(undefined),
}));

import { createRebalanceLimitOrder } from '../src/services/rebalance.js';
import { createLimitOrder } from '../src/services/binance.js';

describe('createRebalanceLimitOrder', () => {
  it('calls createLimitOrder with derived params', async () => {
    const log = { info: () => {}, error: () => {} } as any;
    const positions = [
      { sym: 'BTC', value_usdt: 60 },
      { sym: 'ETH', value_usdt: 40 },
    ];
    await createRebalanceLimitOrder({
      userId: 'u1',
      tokenA: 'BTC',
      tokenB: 'ETH',
      positions,
      newAllocation: 80,
      log,
    });
    expect(createLimitOrder).toHaveBeenCalledWith('u1', {
      symbol: 'BTCETH',
      side: 'BUY',
      quantity: 0.2,
      price: 100,
    });
  });
});
