import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');

const reviewPortfolioMock = vi.fn(() => new Promise(() => {}));
vi.mock('../src/jobs/review-portfolio.js', () => ({ default: reviewPortfolioMock }));

import buildServer from '../src/server.js';
import { encrypt } from '../src/util/crypto.js';

migrate();

function addUser(id: string) {
  const ai = encrypt('aikey', process.env.KEY_PASSWORD!);
  const bk = encrypt('bkey', process.env.KEY_PASSWORD!);
  const bs = encrypt('skey', process.env.KEY_PASSWORD!);
  db.prepare(
    'INSERT INTO users (id, ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc) VALUES (?, ?, ?, ?)'
  ).run(id, ai, bk, bs);
}

describe('agent creation', () => {
  it('does not await initial review', async () => {
    const app = await buildServer();
    addUser('u1');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [{ asset: 'USDT', free: '100', locked: '0' }] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [] }),
      } as any);
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const payload = {
      userId: 'u1',
      model: 'm',
      name: 'Draft',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
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
      headers: { 'x-user-id': 'u1' },
      payload,
    });
    const res = await Promise.race([
      createPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 200),
      ),
    ]);
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect(res.json()).toMatchObject({ id, ...payload });
    expect(reviewPortfolioMock).toHaveBeenCalledTimes(1);
    expect(reviewPortfolioMock.mock.calls[0][1]).toBe(id);

    (globalThis as any).fetch = originalFetch;
    await app.close();
  });
});

