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
      status: 'active',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user1' },
      payload,
    });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect(res.json()).toMatchObject({ id, ...payload });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...payload });

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

    const update = { ...payload, model: 'o3', status: 'draft' };
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
      url: '/api/agents?status=draft',
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
        status: 'active',
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

  it('starts and stops agent', async () => {
    const app = await buildServer();
    addUser('starter');
    const draftPayload = {
      userId: 'starter',
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
      status: 'draft',
    };
    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'starter' },
      payload: draftPayload,
    });
    const id = resCreate.json().id as string;

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

    let res = await app.inject({
      method: 'POST',
      url: `/api/agents/${id}/start`,
      headers: { 'x-user-id': 'starter' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'active' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getActiveAgents().find((a) => a.id === id)).toBeDefined();

    res = await app.inject({
      method: 'POST',
      url: `/api/agents/${id}/stop`,
      headers: { 'x-user-id': 'starter' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'inactive' });
    expect(getActiveAgents().find((a) => a.id === id)).toBeUndefined();

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
      payload: { ...basePayload, status: 'active' },
    });
    expect(res.statusCode).toBe(400);

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'u1' },
      payload: { ...basePayload, status: 'draft' },
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
      payload: { ...basePayload, userId: 'u2', name: 'Active', status: 'active' },
    });
    expect(res.statusCode).toBe(200);
    const activeId = res.json().id as string;

    const resDraft2 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'u2' },
      payload: { ...basePayload, userId: 'u2', name: 'Draft2', status: 'draft' },
    });
    const draft2Id = resDraft2.json().id as string;

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
      status: 'active',
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
      status: 'draft',
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

  it('rejects duplicate draft updates', async () => {
    const app = await buildServer();
    addUserNoKeys('updUser');

    const base = {
      userId: 'updUser',
      model: 'm1',
      name: 'Draft1',
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 50,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'p',
      status: 'draft',
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'updUser' },
      payload: base,
    });
    const draft1 = res1.json().id as string;

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'updUser' },
      payload: { ...base, name: 'Draft2', tokenB: 'SOL' },
    });
    const draft2 = res2.json().id as string;

    const resUpd = await app.inject({
      method: 'PUT',
      url: `/api/agents/${draft2}`,
      headers: { 'x-user-id': 'updUser' },
      payload: { ...base },
    });
    expect(resUpd.statusCode).toBe(400);
    expect(resUpd.json().error).toContain('Draft1');
    expect(resUpd.json().error).toContain(draft1);

    await app.close();
  });
});
