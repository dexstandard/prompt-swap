import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';
import { encrypt } from '../src/util/crypto.js';
const { getActiveAgents } = await import('../src/repos/agents.js');

migrate();

function addUser(id: string) {
  const ai = encrypt('aikey', process.env.KEY_PASSWORD!);
  const bk = encrypt('bkey', process.env.KEY_PASSWORD!);
  const bs = encrypt('skey', process.env.KEY_PASSWORD!);
  db.prepare(
    'INSERT INTO users (id, ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc) VALUES (?, ?, ?, ?)'
  ).run(id, ai, bk, bs);
}

function addUserNoKeys(id: string) {
  db.prepare('INSERT INTO users (id) VALUES (?)').run(id);
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

    res = await app.inject({
      method: 'GET',
      url: '/api/agents?status=active',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10&status=active',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });

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
      method: 'GET',
      url: '/api/agents?status=active',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);

    res = await app.inject({
      method: 'GET',
      url: '/api/agents?status=inactive',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);

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

  it('handles drafts and api key validation', async () => {
    const app = await buildServer();
    addUserNoKeys('u1');

    const basePayload = {
      userId: 'u1',
      model: '',
      name: 'Draft1',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 50,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'u1' },
      payload: { ...basePayload, draft: false },
    });
    expect(res.statusCode).toBe(400);

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'u1' },
      payload: { ...basePayload, draft: true },
    });
    expect(res.statusCode).toBe(200);
    const draftId = res.json().id as string;

    addUser('u2');
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
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'u2' },
      payload: { ...basePayload, userId: 'u2', name: 'Active', draft: false },
    });
    expect(res.statusCode).toBe(200);
    const activeId = res.json().id as string;

    const resDraft2 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'u2' },
      payload: { ...basePayload, userId: 'u2', name: 'Draft2', draft: true },
    });
    const draft2Id = resDraft2.json().id as string;

    db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('active', draft2Id);

    const activeAgents = getActiveAgents();
    expect(activeAgents.find((a) => a.id === activeId)).toBeDefined();
    expect(activeAgents.find((a) => a.id === draftId)).toBeUndefined();
    expect(activeAgents.find((a) => a.id === draft2Id)).toBeUndefined();

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('checks duplicates based on status and tokens', async () => {
    const app = await buildServer();
    addUser('dupUser');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ balances: [{ asset: 'USDT', free: '100', locked: '0' }] }),
        text: async () => 'ok',
      } as any);
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const base = {
      userId: 'dupUser',
      model: 'm',
      name: 'A1',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'p',
      draft: false,
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'dupUser' },
      payload: base,
    });
    const existingId = res1.json().id as string;

    const resDup = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'dupUser' },
      payload: { ...base, name: 'B1', tokenA: 'BTC', tokenB: 'SOL' },
    });
    expect(resDup.statusCode).toBe(400);
    expect(resDup.json().error).toContain('BTC');
    expect(resDup.json().error).toContain('A1');
    expect(resDup.json().error).toContain(existingId);

    db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('inactive', existingId);

    const resOk = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'dupUser' },
      payload: { ...base, name: 'B2', tokenA: 'BTC', tokenB: 'SOL' },
    });
    expect(resOk.statusCode).toBe(200);

    await app.close();
    (globalThis as any).fetch = origFetch;
  });

  it('detects identical drafts', async () => {
    const app = await buildServer();
    addUserNoKeys('draftUser');

    const draftPayload = {
      userId: 'draftUser',
      model: 'm',
      name: 'Draft',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 50,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'p',
      draft: true,
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'draftUser' },
      payload: draftPayload,
    });
    const draftId = res1.json().id as string;

    const resDup = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'draftUser' },
      payload: draftPayload,
    });
    expect(resDup.statusCode).toBe(400);
    expect(resDup.json().error).toContain('Draft');
    expect(resDup.json().error).toContain(draftId);

    const resOk = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'draftUser' },
      payload: { ...draftPayload, name: 'Draft2' },
    });
    expect(resOk.statusCode).toBe(200);

    await app.close();
  });
});
