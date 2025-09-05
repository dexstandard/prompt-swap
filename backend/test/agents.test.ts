import { describe, it, expect, vi } from 'vitest';
import buildServer from '../src/server.js';
import { encrypt } from '../src/util/crypto.js';
import { getActiveAgents, getAgent } from '../src/repos/agents.js';
import { db } from '../src/db/index.js';
import { insertUser } from './repos/users.js';
import { setAiKey, setBinanceKey } from '../src/repos/api-keys.js';
import { setAgentStatus } from './repos/agents.js';
import { cancelOpenOrders } from '../src/services/binance.js';
import { authCookies } from './helpers.js';

vi.mock('../src/jobs/review-portfolio.js', () => ({
  reviewAgentPortfolio: vi.fn(() => Promise.resolve()),
  removeAgentFromSchedule: vi.fn(),
}));

vi.mock('../src/services/binance.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/binance.js')>(
    '../src/services/binance.js',
  );
  return { ...actual, cancelOpenOrders: vi.fn().mockResolvedValue(undefined) };
});

async function addUser(id: string) {
  const ai = encrypt('aikey', process.env.KEY_PASSWORD!);
  const bk = encrypt('bkey', process.env.KEY_PASSWORD!);
  const bs = encrypt('skey', process.env.KEY_PASSWORD!);
  const userId = await insertUser(id, null);
  await setAiKey(userId, ai);
  await setBinanceKey(userId, bk, bs);
  return userId;
}

async function addUserNoKeys(id: string) {
  const userId = await insertUser(id);
  return userId;
}

describe('agent routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    const userId = await addUser('1');

    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            { asset: 'BTC', free: '1', locked: '0' },
            { asset: 'ETH', free: '1', locked: '0' },
          ],
        }),
      } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '60' }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '40' }) } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            { asset: 'BTC', free: '1', locked: '0' },
            { asset: 'ETH', free: '1', locked: '0' },
          ],
        }),
      } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '60' }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '40' }) } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [] }),
      } as any);
    fetchMock.mockResolvedValue({ text: async () => 'ok' } as any);
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const payload = {
      userId,
      model: 'gpt-5',
      name: 'A1',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
      status: 'active',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(userId),
      payload,
    });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
      expect(res.json()).toMatchObject({ id, ...payload, startBalanceUsd: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id, ...payload, startBalanceUsd: 100 });

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10',
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10&status=active',
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    const update = { ...payload, model: 'o3', status: 'draft' };
    res = await app.inject({
      method: 'PUT',
      url: `/api/agents/${id}`,
      cookies: authCookies(userId),
      payload: update,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...update });

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10&status=active',
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 0, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(0);

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10&status=draft',
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    const execRes = await db.query(
      "INSERT INTO agent_review_result (agent_id, log) VALUES ($1, '') RETURNING id",
      [id],
    );
    await db.query(
      'INSERT INTO limit_order (user_id, planned_json, status, review_result_id, order_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, '{}', 'open', execRes.rows[0].id, '123'],
    );

    res = await app.inject({
      method: 'DELETE',
      url: `/api/agents/${id}`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    const deletedRow = await db.query('SELECT status FROM agents WHERE id = $1', [
      id,
    ]);
    expect(deletedRow.rows[0].status).toBe('retired');
    expect(await getAgent(id)).toBeUndefined();
    expect((await getActiveAgents()).find((a) => a.id === id)).toBeUndefined();
    expect(cancelOpenOrders).toHaveBeenCalledWith(userId, { symbol: 'BTCETH' });
    const execRow = await db.query(
      'SELECT status FROM limit_order WHERE review_result_id = $1',
      [execRes.rows[0].id],
    );
    expect(execRow.rows[0].status).toBe('canceled');

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10',
      cookies: authCookies(userId),
    });
    expect(res.json().items).toHaveLength(0);

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10&status=retired',
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(0);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}`,
      cookies: authCookies(userId),
    });
    expect(res.statusCode).toBe(404);

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies('999'),
      payload: { ...payload, userId, name: 'A2' },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('starts and stops agent', async () => {
    const app = await buildServer();
    const starterId = await addUser('starter');
    const draftPayload = {
      userId: starterId,
      model: 'm',
      name: 'Draft',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
      status: 'draft',
    };
    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(starterId),
      payload: draftPayload,
    });
    const id = resCreate.json().id as string;

    const fetchMock = vi.fn();
    fetchMock
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
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [] }),
      } as any);
    fetchMock.mockResolvedValue({ text: async () => 'ok' } as any);
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    let res = await app.inject({
      method: 'POST',
      url: `/api/agents/${id}/start`,
      cookies: authCookies(starterId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'active' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((await getActiveAgents()).find((a) => a.id === id)).toBeDefined();

    res = await app.inject({
      method: 'POST',
      url: `/api/agents/${id}/stop`,
      cookies: authCookies(starterId),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'inactive' });
    expect((await getActiveAgents()).find((a) => a.id === id)).toBeUndefined();

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('updates running agent and refreshes start balance', async () => {
    const app = await buildServer();
    const updateUserId = await addUser('update-user');
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
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            { asset: 'BTC', free: '2', locked: '0' },
            { asset: 'ETH', free: '2', locked: '0' },
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
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [] }),
      } as any);
    fetchMock.mockResolvedValue({ text: async () => 'ok' } as any);
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const createPayload = {
      userId: updateUserId,
      model: 'm',
      name: 'A',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
      status: 'active',
    };

    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(updateUserId),
      payload: createPayload,
    });
    expect(resCreate.statusCode).toBe(200);
    const id = resCreate.json().id as string;

    const updatePayload = {
      ...createPayload,
      tokens: [
        { token: 'BTC', minAllocation: 15 },
        { token: 'ETH', minAllocation: 20 },
      ],
    };
    const resUpdate = await app.inject({
      method: 'PUT',
      url: `/api/agents/${id}`,
      cookies: authCookies(updateUserId),
      payload: updatePayload,
    });
    expect(resUpdate.statusCode).toBe(200);
    const row = await getAgent(id);
    expect(row?.start_balance).toBeGreaterThanOrEqual(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('handles drafts and api key validation', async () => {
    const app = await buildServer();
    const u1Id = await addUserNoKeys('1');

    const basePayload = {
      userId: u1Id,
      model: 'm',
      name: 'Draft1',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(u1Id),
      payload: { ...basePayload, status: 'active' },
    });
    expect(res.statusCode).toBe(400);

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(u1Id),
      payload: { ...basePayload, status: 'draft' },
    });
    expect(res.statusCode).toBe(200);
    const draftId = res.json().id as string;

    const u2Id = await addUser('2');
    const fetchMock = vi.fn();
    fetchMock
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
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balances: [] }),
      } as any);
    fetchMock.mockResolvedValue({ text: async () => 'ok' } as any);
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(u2Id),
      payload: { ...basePayload, userId: u2Id, name: 'Active', status: 'active' },
    });
    expect(res.statusCode).toBe(200);
    const activeId = res.json().id as string;

    const resDraft2 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(u2Id),
      payload: { ...basePayload, userId: u2Id, name: 'Draft2', status: 'draft' },
    });
    const draft2Id = resDraft2.json().id as string;

    const activeAgents = await getActiveAgents();
    expect(activeAgents.find((a) => a.id === activeId)).toBeDefined();
    expect(activeAgents.find((a) => a.id === draftId)).toBeUndefined();
    expect(activeAgents.find((a) => a.id === draft2Id)).toBeUndefined();

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('checks duplicates based on status and tokens', async () => {
    const app = await buildServer();
    const dupId = await addUser('dupUser');
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            { asset: 'BTC', free: '1', locked: '0' },
            { asset: 'ETH', free: '1', locked: '0' },
          ],
        }),
      } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '60' }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '40' }) } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balances: [
            { asset: 'BTC', free: '1', locked: '0' },
            { asset: 'ETH', free: '1', locked: '0' },
          ],
        }),
      } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '60' }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '40' }) } as any);
    fetchMock.mockResolvedValue({ text: async () => 'ok' } as any);
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const base = {
      userId: dupId,
      model: 'm',
      name: 'A1',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'p',
      status: 'active',
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(dupId),
      payload: base,
    });
    const existingId = res1.json().id as string;

    const resDup = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(dupId),
      payload: {
        ...base,
        name: 'B1',
        tokens: [
          { token: 'BTC', minAllocation: 10 },
          { token: 'SOL', minAllocation: 20 },
        ],
      },
    });
    expect(resDup.statusCode).toBe(400);
    expect(resDup.json().error).toContain('BTC');
    expect(resDup.json().error).toContain('A1');
    expect(resDup.json().error).toContain(existingId);

    await setAgentStatus(existingId, 'inactive');

    const resOk = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(dupId),
      payload: {
        ...base,
        name: 'B2',
        tokens: [
          { token: 'BTC', minAllocation: 10 },
          { token: 'SOL', minAllocation: 20 },
        ],
      },
    });
    expect(resOk.statusCode).toBe(200);

    await app.close();
    (globalThis as any).fetch = origFetch;
  });

  it('detects identical drafts', async () => {
    const app = await buildServer();
    const draftUserId = await addUserNoKeys('draftUser');

    const draftPayload = {
      userId: draftUserId,
      model: 'm',
      name: 'Draft',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'p',
      status: 'draft',
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(draftUserId),
      payload: draftPayload,
    });
    const draftId = res1.json().id as string;

    const resDup = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(draftUserId),
      payload: draftPayload,
    });
    expect(resDup.statusCode).toBe(400);
    expect(resDup.json().error).toContain('Draft');
    expect(resDup.json().error).toContain(draftId);

    const resOk = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(draftUserId),
      payload: { ...draftPayload, name: 'Draft2' },
    });
    expect(resOk.statusCode).toBe(200);

    await app.close();
  });

  it('rejects duplicate draft updates', async () => {
    const app = await buildServer();
    const updId = await addUserNoKeys('updUser');

    const base = {
      userId: updId,
      model: 'm1',
      name: 'Draft1',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'p',
      status: 'draft',
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(updId),
      payload: base,
    });
    const draft1 = res1.json().id as string;

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(updId),
      payload: {
        ...base,
        name: 'Draft2',
        tokens: [
          { token: 'BTC', minAllocation: 10 },
          { token: 'SOL', minAllocation: 20 },
        ],
      },
    });
    const draft2 = res2.json().id as string;

    const resUpd = await app.inject({
      method: 'PUT',
      url: `/api/agents/${draft2}`,
      cookies: authCookies(updId),
      payload: { ...base },
    });
    expect(resUpd.statusCode).toBe(400);
    expect(resUpd.json().error).toContain('Draft1');
    expect(resUpd.json().error).toContain(draft1);

    await app.close();
  });

  it('fails to start agent without model', async () => {
    const app = await buildServer();
    const nomodelId = await addUser('nomodel');
    const payload = {
      userId: nomodelId,
      model: '',
      name: 'Draft',
      tokens: [
        { token: 'BTC', minAllocation: 10 },
        { token: 'ETH', minAllocation: 20 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
      status: 'draft',
    };
    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(nomodelId),
      payload,
    });
    const id = resCreate.json().id as string;
    const resStart = await app.inject({
      method: 'POST',
      url: `/api/agents/${id}/start`,
      cookies: authCookies(nomodelId),
    });
    expect(resStart.statusCode).toBe(400);
    expect(resStart.json().error).toContain('model');
    await app.close();
  });

  it('rejects allocations exceeding 95%', async () => {
    const app = await buildServer();
    const allocId = await addUserNoKeys('allocUser');
    const payload = {
      userId: allocId,
      model: 'm',
      name: 'Bad',
      tokens: [
        { token: 'BTC', minAllocation: 60 },
        { token: 'ETH', minAllocation: 40 },
      ],
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'p',
      status: 'draft',
    };
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      cookies: authCookies(allocId),
      payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('minimum allocations');
    await app.close();
  });
});
