import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';
import { encrypt } from '../src/util/crypto.js';

migrate();

describe('binance prices route', () => {
  it('returns price history for token', async () => {
    const app = await buildServer();
    const key = 'binKey123456';
    const secret = 'binSecret123456';
    const encKey = encrypt(key, process.env.KEY_PASSWORD!);
    const encSecret = encrypt(secret, process.env.KEY_PASSWORD!);
    db.prepare(
      'INSERT INTO users (id, binance_api_key_enc, binance_api_secret_enc) VALUES (?, ?, ?)'
    ).run('user1', encKey, encSecret);

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        [1, '1', '1', '1', '2'],
        [2, '1', '1', '1', '3'],
      ],
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user1/binance-prices/BTC',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      prices: [
        { time: 1, close: 2 },
        { time: 2, close: 3 },
      ],
    });

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it("forbids accessing another user's price history", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/other/binance-prices/BTC',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns 404 when user has no binance key', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user2');
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user2/binance-prices/BTC',
      headers: { 'x-user-id': 'user2' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
