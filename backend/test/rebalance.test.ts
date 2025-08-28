import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { getExecutions } from './repos/executions.js';
import { insertUser } from './repos/users.js';
import { insertAgent } from './repos/agents.js';
import { insertExecResult } from './repos/agent-exec-result.js';

vi.mock('../src/services/binance.js', () => ({
  fetchPairData: vi.fn().mockResolvedValue({ currentPrice: 100 }),
  createLimitOrder: vi.fn().mockResolvedValue(undefined),
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
    const execResultId = await insertExecResult({ agentId: agent.id, log: '' });
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
      execResultId,
    });

    const row = (await getExecutions())[0];

    expect(row.user_id).toBe(userId);
    expect(JSON.parse(row.planned_json)).toMatchObject({
      symbol: 'BTCETH',
      side: 'BUY',
      quantity: 0.5,
      price: 100,
    });
    expect(row.status).toBe('pending');
    expect(row.exec_result_id).toBe(execResultId);
    expect(createLimitOrder).toHaveBeenCalledWith(userId, {
      symbol: 'BTCETH',
      side: 'BUY',
      quantity: 0.5,
      price: 100,
    });
  });
});
