import { describe, it, expect, vi } from 'vitest';
import { insertUser } from './repos/users.js';
import { setAiKey, setBinanceKey } from '../src/repos/api-keys.js';

const reviewAgentPortfolioMock = vi.fn<
  (log: unknown, agentId: string) => Promise<unknown>
>(() => new Promise(() => {}));
vi.mock('../src/jobs/review-portfolio.js', () => ({
  reviewAgentPortfolio: reviewAgentPortfolioMock,
}));

import buildServer from '../src/server.js';
import { encrypt } from '../src/util/crypto.js';

async function addUser(id: string) {
  const ai = encrypt('aikey', process.env.KEY_PASSWORD!);
  const bk = encrypt('bkey', process.env.KEY_PASSWORD!);
  const bs = encrypt('skey', process.env.KEY_PASSWORD!);
  const userId = await insertUser(id, null);
  await setAiKey(userId, ai);
  await setBinanceKey(userId, bk, bs);
  return userId;
}

describe('agent creation', () => {
  it('does not await initial review', async () => {
    const app = await buildServer();
    const userId = await addUser('1');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            { asset: 'BTC', free: '1', locked: '0' },
            { asset: 'ETH', free: '1', locked: '0' },
          ],
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ price: '60' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ price: '40' }),
      } as any);
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const payload = {
      userId,
      model: 'm',
      name: 'Draft',
      tokenA: 'BTC',
      tokenB: 'ETH',
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
      status: 'active',
    };

    const createPromise = app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': userId },
      payload,
    });
    const res = await Promise.race([
      createPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 1000),
      ),
    ]);
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect(res.json()).toMatchObject({ id, ...payload });
    expect(reviewAgentPortfolioMock).toHaveBeenCalledTimes(1);
    expect(reviewAgentPortfolioMock.mock.calls[0][1]).toBe(id);

    (globalThis as any).fetch = originalFetch;
    await app.close();
  });
});

