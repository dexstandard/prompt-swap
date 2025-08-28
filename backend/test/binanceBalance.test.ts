import { describe, it, expect, vi } from 'vitest';
import buildServer from '../src/server.js';
import { encrypt } from '../src/util/crypto.js';
import { insertUser } from './repos/users.js';
import { setBinanceKey } from '../src/repos/api-keys.js';

describe('binance balance route', () => {
  it('returns aggregated balance for user', async () => {
    const app = await buildServer();
    const key = 'binKey123456';
    const secret = 'binSecret123456';
    const encKey = encrypt(key, process.env.KEY_PASSWORD!);
    const encSecret = encrypt(secret, process.env.KEY_PASSWORD!);
    const userId = await insertUser('1');
    await setBinanceKey(userId, encKey, encSecret);

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        balances: [
          { asset: 'BTC', free: '1', locked: '0' },
          { asset: 'USDT', free: '100', locked: '0' },
        ],
      }),
    } as any);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ price: '20000' }),
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: `/api/users/${userId}/binance-balance`,
      headers: { 'x-user-id': userId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ totalUsd: 20100 });

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('returns balance for a specific token', async () => {
    const app = await buildServer();
    const key = 'binKey123456';
    const secret = 'binSecret123456';
    const encKey = encrypt(key, process.env.KEY_PASSWORD!);
    const encSecret = encrypt(secret, process.env.KEY_PASSWORD!);
    const userId = await insertUser('2');
    await setBinanceKey(userId, encKey, encSecret);

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        balances: [{ asset: 'BTC', free: '1.5', locked: '0.5' }],
      }),
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: `/api/users/${userId}/binance-balance/BTC`,
      headers: { 'x-user-id': userId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ asset: 'BTC', free: 1.5, locked: 0.5 });

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('forbids accessing another user\'s balance', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/999/binance-balance',
      headers: { 'x-user-id': '1' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
