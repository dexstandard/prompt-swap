import { describe, it, expect, vi } from 'vitest';
import buildServer from '../src/server.js';
import { insertUser } from './repos/users.js';
import { insertAgent } from './repos/agents.js';

const reviewAgentPortfolioMock = vi.fn<(
  log: unknown,
  agentId: string,
) => Promise<unknown>>(() => Promise.resolve());
vi.mock('../src/jobs/review-portfolio.js', () => ({
  reviewAgentPortfolio: reviewAgentPortfolioMock,
}));

describe('manual review endpoint', () => {
  it('triggers portfolio review', async () => {
    const app = await buildServer();
    await insertUser('u1');
    const agentId = 'a1';
    await insertAgent({
      id: agentId,
      userId: 'u1',
      model: 'gpt',
      status: 'active',
      createdAt: 0,
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

    const res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentId}/review`,
      headers: { 'x-user-id': 'u1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(reviewAgentPortfolioMock).toHaveBeenCalledTimes(1);
    expect(reviewAgentPortfolioMock.mock.calls[0][1]).toBe(agentId);
    await app.close();
  });

  it('returns error when agent is already reviewing', async () => {
    const app = await buildServer();
    await insertUser('u2');
    const agentId = 'b1';
    await insertAgent({
      id: agentId,
      userId: 'u2',
      model: 'gpt',
      status: 'active',
      createdAt: 0,
      startBalance: null,
      name: 'A2',
      tokenA: 'BTC',
      tokenB: 'ETH',
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'inst',
      manualRebalance: false,
    });
    reviewAgentPortfolioMock.mockRejectedValueOnce(
      new Error('Agent is already reviewing portfolio'),
    );
    const res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentId}/review`,
      headers: { 'x-user-id': 'u2' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Agent is already reviewing portfolio' });
    await app.close();
  });
});
