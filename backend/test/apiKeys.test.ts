import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';

migrate();

describe('AI API key routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user1');

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;

    const key1 = 'aikey1234567890';
    const key2 = 'aikeyabcdefghij';

    fetchMock.mockResolvedValueOnce({ ok: false } as any);
    let res = await app.inject({
      method: 'POST',
      url: '/api/users/user1/ai-key',
      payload: { key: 'bad' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'verification failed' });
    let row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get('user1') as any;
    expect(row.ai_api_key_enc).toBeNull();

    fetchMock.mockResolvedValueOnce({ ok: true } as any);
    res = await app.inject({
      method: 'POST',
      url: '/api/users/user1/ai-key',
      payload: { key: key1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'aike...7890' });
    row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get('user1') as any;
    expect(row.ai_api_key_enc).not.toBe(key1);

    res = await app.inject({ method: 'GET', url: '/api/users/user1/ai-key' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'aike...7890' });

    res = await app.inject({
      method: 'POST',
      url: '/api/users/user1/ai-key',
      payload: { key: 'dup' },
    });
    expect(res.statusCode).toBe(400);

    fetchMock.mockResolvedValueOnce({ ok: false } as any);
    res = await app.inject({
      method: 'PUT',
      url: '/api/users/user1/ai-key',
      payload: { key: 'bad2' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'verification failed' });
    res = await app.inject({ method: 'GET', url: '/api/users/user1/ai-key' });
    expect(res.json()).toMatchObject({ key: 'aike...7890' });

    fetchMock.mockResolvedValueOnce({ ok: true } as any);
    res = await app.inject({
      method: 'PUT',
      url: '/api/users/user1/ai-key',
      payload: { key: key2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'aike...ghij' });

    res = await app.inject({ method: 'DELETE', url: '/api/users/user1/ai-key' });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: '/api/users/user1/ai-key' });
    expect(res.statusCode).toBe(404);

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });
});

describe('Binance API key routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user2');

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
      url: '/api/users/user2/binance-key',
      payload: { key: 'bad', secret: 'bad' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'verification failed' });
    let row = db
      .prepare(
        'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
      )
      .get('user2') as any;
    expect(row.binance_api_key_enc).toBeNull();
    expect(row.binance_api_secret_enc).toBeNull();

    fetchMock.mockResolvedValueOnce({ ok: true } as any);
    res = await app.inject({
      method: 'POST',
      url: '/api/users/user2/binance-key',
      payload: { key: key1, secret: secret1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      key: 'bkey...7890',
      secret: 'bsec...7890',
    });
    row = db
      .prepare(
        'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
      )
      .get('user2') as any;
    expect(row.binance_api_key_enc).not.toBe(key1);
    expect(row.binance_api_secret_enc).not.toBe(secret1);

    res = await app.inject({ method: 'GET', url: '/api/users/user2/binance-key' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      key: 'bkey...7890',
      secret: 'bsec...7890',
    });

    res = await app.inject({
      method: 'POST',
      url: '/api/users/user2/binance-key',
      payload: { key: 'dup', secret: 'dup' },
    });
    expect(res.statusCode).toBe(400);

    fetchMock.mockResolvedValueOnce({ ok: false } as any);
    res = await app.inject({
      method: 'PUT',
      url: '/api/users/user2/binance-key',
      payload: { key: 'bad2', secret: 'bad2' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'verification failed' });
    res = await app.inject({ method: 'GET', url: '/api/users/user2/binance-key' });
    expect(res.json()).toMatchObject({
      key: 'bkey...7890',
      secret: 'bsec...7890',
    });

    fetchMock.mockResolvedValueOnce({ ok: true } as any);
    res = await app.inject({
      method: 'PUT',
      url: '/api/users/user2/binance-key',
      payload: { key: key2, secret: secret2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      key: 'bkey...ghij',
      secret: 'bsec...ghij',
    });

    res = await app.inject({ method: 'DELETE', url: '/api/users/user2/binance-key' });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: '/api/users/user2/binance-key' });
    expect(res.statusCode).toBe(404);

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });
});
