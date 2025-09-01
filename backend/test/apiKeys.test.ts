import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/jobs/review-portfolio.js', () => ({
  removeAgentFromSchedule: vi.fn(),
}));

vi.mock('../src/services/binance.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/binance.js')>(
    '../src/services/binance.js',
  );
  return { ...actual, cancelOpenOrders: vi.fn().mockResolvedValue(undefined) };
});

import buildServer from '../src/server.js';
import { insertUser } from './repos/users.js';
import {
  getAiKeyRow,
  getBinanceKeyRow,
  setAiKey,
  setBinanceKey,
} from '../src/repos/api-keys.js';
import { insertAgent } from './repos/agents.js';
import { db } from '../src/db/index.js';
import { encrypt } from '../src/util/crypto.js';
import { removeAgentFromSchedule } from '../src/jobs/review-portfolio.js';
import { cancelOpenOrders } from '../src/services/binance.js';

describe('AI API key routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    const userId = await insertUser('1');

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const key1 = 'aikey1234567890';
    const key2 = 'aikeyabcdefghij';

    fetchMock.mockResolvedValueOnce({ ok: false } as any);
    let res = await app.inject({
      method: 'POST',
      url: `/api/users/${userId}/ai-key`,
      payload: { key: 'bad' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'verification failed' });
    let row = await getAiKeyRow(userId);
    expect(row!.ai_api_key_enc).toBeNull();

    fetchMock.mockResolvedValueOnce({ ok: true } as any);
    res = await app.inject({
      method: 'POST',
      url: `/api/users/${userId}/ai-key`,
      payload: { key: key1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'aike...7890' });
    row = await getAiKeyRow(userId);
    expect(row!.ai_api_key_enc).not.toBe(key1);

    res = await app.inject({ method: 'GET', url: `/api/users/${userId}/ai-key` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'aike...7890' });

    res = await app.inject({
      method: 'POST',
      url: `/api/users/${userId}/ai-key`,
      payload: { key: 'dup' },
    });
    expect(res.statusCode).toBe(400);

    fetchMock.mockResolvedValueOnce({ ok: false } as any);
    res = await app.inject({
      method: 'PUT',
      url: `/api/users/${userId}/ai-key`,
      payload: { key: 'bad2' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'verification failed' });
    res = await app.inject({ method: 'GET', url: `/api/users/${userId}/ai-key` });
    expect(res.json()).toMatchObject({ key: 'aike...7890' });

    fetchMock.mockResolvedValueOnce({ ok: true } as any);
    res = await app.inject({
      method: 'PUT',
      url: `/api/users/${userId}/ai-key`,
      payload: { key: key2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'aike...ghij' });

    res = await app.inject({ method: 'DELETE', url: `/api/users/${userId}/ai-key` });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: `/api/users/${userId}/ai-key` });
    expect(res.statusCode).toBe(404);

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });
});

describe('Binance API key routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    const userId = await insertUser('2');

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const key1 = 'bkey1234567890';
    const key2 = 'bkeyabcdefghij';
    const secret1 = 'bsec1234567890';
    const secret2 = 'bsecabcdefghij';

    fetchMock.mockResolvedValueOnce({ ok: false } as any);
    let res = await app.inject({
      method: 'POST',
      url: `/api/users/${userId}/binance-key`,
      payload: { key: 'bad', secret: 'bad' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'verification failed' });
    let row = await getBinanceKeyRow(userId);
    expect(row!.binance_api_key_enc).toBeNull();
    expect(row!.binance_api_secret_enc).toBeNull();

    fetchMock.mockResolvedValueOnce({ ok: true } as any);
    res = await app.inject({
      method: 'POST',
      url: `/api/users/${userId}/binance-key`,
      payload: { key: key1, secret: secret1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      key: 'bkey...7890',
      secret: 'bsec...7890',
    });
    row = await getBinanceKeyRow(userId);
    expect(row!.binance_api_key_enc).not.toBe(key1);
    expect(row!.binance_api_secret_enc).not.toBe(secret1);

    res = await app.inject({ method: 'GET', url: `/api/users/${userId}/binance-key` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      key: 'bkey...7890',
      secret: 'bsec...7890',
    });

    res = await app.inject({
      method: 'POST',
      url: `/api/users/${userId}/binance-key`,
      payload: { key: 'dup', secret: 'dup' },
    });
    expect(res.statusCode).toBe(400);

    fetchMock.mockResolvedValueOnce({ ok: false } as any);
    res = await app.inject({
      method: 'PUT',
      url: `/api/users/${userId}/binance-key`,
      payload: { key: 'bad2', secret: 'bad2' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'verification failed' });
    res = await app.inject({ method: 'GET', url: `/api/users/${userId}/binance-key` });
    expect(res.json()).toMatchObject({
      key: 'bkey...7890',
      secret: 'bsec...7890',
    });

    fetchMock.mockResolvedValueOnce({ ok: true } as any);
    res = await app.inject({
      method: 'PUT',
      url: `/api/users/${userId}/binance-key`,
      payload: { key: key2, secret: secret2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      key: 'bkey...ghij',
      secret: 'bsec...ghij',
    });

    res = await app.inject({ method: 'DELETE', url: `/api/users/${userId}/binance-key` });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: `/api/users/${userId}/binance-key` });
    expect(res.statusCode).toBe(404);

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });
});

describe('key deletion effects on agents', () => {
  beforeEach(() => {
    (removeAgentFromSchedule as any).mockClear();
    (cancelOpenOrders as any).mockClear();
  });
  it('stops agents when binance key is deleted', async () => {
    const app = await buildServer();
    const userId = await insertUser('3');
    const ai = encrypt('aikey', process.env.KEY_PASSWORD!);
    const bk = encrypt('bkey', process.env.KEY_PASSWORD!);
    const bs = encrypt('skey', process.env.KEY_PASSWORD!);
    await setAiKey(userId, ai);
    await setBinanceKey(userId, bk, bs);
    const agent = await insertAgent({
      userId,
      model: 'gpt-5',
      status: 'active',
      startBalance: 100,
      name: 'A1',
      tokenA: 'BTC',
      tokenB: 'ETH',
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
      manualRebalance: false,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${userId}/binance-key`,
    });
    expect(res.statusCode).toBe(200);
    const row = await db.query('SELECT status FROM agents WHERE id = $1', [
      agent.id,
    ]);
    expect(row.rows[0].status).toBe('inactive');
    expect(removeAgentFromSchedule).toHaveBeenCalledWith(agent.id);
    expect(cancelOpenOrders).toHaveBeenCalledWith(userId, { symbol: 'BTCETH' });
    await app.close();
  });

  it('sets agents to draft when ai key is deleted', async () => {
    const app = await buildServer();
    const userId = await insertUser('4');
    const ai = encrypt('aikey', process.env.KEY_PASSWORD!);
    const bk = encrypt('bkey', process.env.KEY_PASSWORD!);
    const bs = encrypt('skey', process.env.KEY_PASSWORD!);
    await setAiKey(userId, ai);
    await setBinanceKey(userId, bk, bs);
    const agent = await insertAgent({
      userId,
      model: 'gpt-5',
      status: 'active',
      startBalance: 100,
      name: 'A2',
      tokenA: 'BTC',
      tokenB: 'ETH',
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      reviewInterval: '1h',
      agentInstructions: 'prompt',
      manualRebalance: false,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${userId}/ai-key`,
    });
    expect(res.statusCode).toBe(200);
    const row = await db.query('SELECT status, model FROM agents WHERE id = $1', [
      agent.id,
    ]);
    expect(row.rows[0].status).toBe('draft');
    expect(row.rows[0].model).toBeNull();
    expect(removeAgentFromSchedule).toHaveBeenCalledWith(agent.id);
    expect(cancelOpenOrders).toHaveBeenCalledWith(userId, { symbol: 'BTCETH' });
    await app.close();
  });
});
