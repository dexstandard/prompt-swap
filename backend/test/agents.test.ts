import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
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

describe('agent routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    addUser('user1');

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        balances: [{ asset: 'USDT', free: '100', locked: '0' }],
      }),
    } as any);
    fetchMock.mockResolvedValue({ text: async () => 'ok' } as any);
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const payload = {
      userId: 'user1',
      model: 'gpt-5',
      name: 'A1',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
      draft: false,
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user1' },
      payload,
    });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect(res.json()).toMatchObject({ id, ...payload, status: 'active' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...payload, status: 'active' });

    res = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    const update = { ...payload, model: 'o3', status: 'inactive', draft: true };
    res = await app.inject({
      method: 'PUT',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
      payload: update,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...update });

    res = await app.inject({
      method: 'DELETE',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(404);

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user2' },
      payload: { ...payload, userId: 'user3', name: 'A2' },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('returns current pnl for agent', async () => {
    const app = await buildServer();
    addUser('user5');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [{ asset: 'USDT', free: '100', locked: '0' }],
        }),
      } as any)
      .mockResolvedValueOnce({ text: async () => 'ok' } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [{ asset: 'USDT', free: '150', locked: '0' }],
        }),
      } as any);
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user5' },
      payload: {
        userId: 'user5',
        model: 'm1',
        name: 'A5',
        tokenA: 'BTC',
        tokenB: 'ETH',
        targetAllocation: 60,
        minTokenAAllocation: 10,
        minTokenBAllocation: 20,
        risk: 'low',
        reviewInterval: '1h',
        agentInstructions: 'prompt',
        draft: false,
      },
    });
    const id = resCreate.json().id as string;

    const resPnl = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}/pnl`,
      headers: { 'x-user-id': 'user5' },
    });
    expect(resPnl.statusCode).toBe(200);
    expect(resPnl.json()).toEqual({
      startBalanceUsd: 100,
      currentBalanceUsd: 150,
      pnlUsd: 50,
    });

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });
});
