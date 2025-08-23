import { describe, it, expect, vi } from 'vitest';
import { db } from '../src/db/index.js';
import buildServer from '../src/server.js';
import { encrypt } from '../src/util/crypto.js';

describe('model routes', () => {
  it('returns filtered models', async () => {
    const app = await buildServer();
    const key = 'aikey1234567890';
    const enc = encrypt(key, process.env.KEY_PASSWORD!);
    db.prepare('INSERT INTO users (id, ai_api_key_enc) VALUES (?, ?)').run(
      'user1',
      enc,
    );

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'foo-search' },
          { id: 'gpt-3.5' },
          { id: 'o3-mini' },
          { id: 'gpt-5' },
        ],
      }),
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user1/models',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ models: ['foo-search', 'o3-mini', 'gpt-5'] });

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it('requires a key', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user2');
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user2/models',
      headers: { 'x-user-id': 'user2' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('caches models by key', async () => {
    const app = await buildServer();
    const key = 'aikey9999999999';
    const enc = encrypt(key, process.env.KEY_PASSWORD!);
    db.prepare('INSERT INTO users (id, ai_api_key_enc) VALUES (?, ?)').run(
      'user3',
      enc,
    );

    const fetchMock = vi.fn();
    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'gpt-5' }] }),
    } as any);

    let res = await app.inject({
      method: 'GET',
      url: '/api/users/user3/models',
      headers: { 'x-user-id': 'user3' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ models: ['gpt-5'] });

    // second request should hit cache
    res = await app.inject({
      method: 'GET',
      url: '/api/users/user3/models',
      headers: { 'x-user-id': 'user3' },
    });
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await app.close();
    (globalThis as any).fetch = originalFetch;
  });

  it("forbids accessing another user's models", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/other/models',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
