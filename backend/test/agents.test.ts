import { describe, it, expect, vi } from 'vitest';
import {
  ERROR_MESSAGES,
  lengthMessage,
  errorResponse,
} from '../src/util/errorMessages.js';

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
      status: 'active',
      name: 'A1',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user1' },
      payload,
    });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect(res.json()).toMatchObject({ status: 'active', tokenA: 'BTC', tokenB: 'ETH' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toMatchObject({
      model: 'gpt-5',
      input: {
        instructions: 'prompt',
        tokenA: 'BTC',
        tokenB: 'ETH',
        targetAllocation: 60,
        minTokenAAllocation: 10,
        minTokenBAllocation: 20,
        risk: 'low',
        reviewInterval: '1h',
      },
    });

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, status: 'active', tokenA: 'BTC', tokenB: 'ETH' });

    res = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0]).toMatchObject({ tokenA: 'BTC', tokenB: 'ETH' });

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0]).toMatchObject({ tokenA: 'BTC', tokenB: 'ETH' });

    const update = { userId: 'user1', model: 'o3', status: 'active' };
    res = await app.inject({
      method: 'PUT',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
      payload: update,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, model: 'o3', status: 'active' });

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

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('creates inactive agent and activates later', async () => {
    const app = await buildServer();
    addUser('user2');

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user2' },
      payload: { userId: 'user2', model: 'm1', status: 'inactive' },
    });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect(res.json().status).toBe('inactive');

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

    res = await app.inject({
      method: 'PUT',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user2' },
      payload: {
        userId: 'user2',
        model: 'm1',
        status: 'active',
        name: 'A2',
        tokenA: 'BTC',
        tokenB: 'SOL',
        targetAllocation: 60,
        minTokenAAllocation: 10,
        minTokenBAllocation: 20,
        risk: 'low',
        reviewInterval: '1h',
        agentInstructions: 'prompt',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('active');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user2' },
      payload: { userId: 'user2', model: 'x'.repeat(51), status: 'inactive' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject(errorResponse(lengthMessage('model', 50)));

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('returns current pnl for agent', async () => {
    const app = await buildServer();
    addUser('user5');

    const fetchMock = vi.fn();
    fetchMock
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
        status: 'active',
        name: 'A5',
        tokenA: 'BTC',
        tokenB: 'ETH',
        targetAllocation: 60,
        minTokenAAllocation: 10,
        minTokenBAllocation: 20,
        risk: 'low',
        reviewInterval: '1h',
        agentInstructions: 'prompt',
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

