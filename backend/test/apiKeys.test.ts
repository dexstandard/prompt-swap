import { describe, it, expect } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';

migrate();

describe('AI API key routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user1');

    let res = await app.inject({
      method: 'POST',
      url: '/users/user1/ai-key',
      payload: { key: 'aikey1' },
    });
    expect(res.statusCode).toBe(200);
    const row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get('user1');
    expect(row.ai_api_key_enc).not.toBe('aikey1');

    res = await app.inject({ method: 'GET', url: '/users/user1/ai-key' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'aikey1' });

    res = await app.inject({
      method: 'POST',
      url: '/users/user1/ai-key',
      payload: { key: 'dup' },
    });
    expect(res.statusCode).toBe(400);

    res = await app.inject({
      method: 'PUT',
      url: '/users/user1/ai-key',
      payload: { key: 'aikey2' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'aikey2' });

    res = await app.inject({ method: 'DELETE', url: '/users/user1/ai-key' });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: '/users/user1/ai-key' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});

describe('Binance API key routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user2');

    let res = await app.inject({
      method: 'POST',
      url: '/users/user2/binance-key',
      payload: { key: 'bkey1' },
    });
    expect(res.statusCode).toBe(200);
    const row = db
      .prepare('SELECT binance_api_key_enc FROM users WHERE id = ?')
      .get('user2');
    expect(row.binance_api_key_enc).not.toBe('bkey1');

    res = await app.inject({ method: 'GET', url: '/users/user2/binance-key' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'bkey1' });

    res = await app.inject({
      method: 'POST',
      url: '/users/user2/binance-key',
      payload: { key: 'dup' },
    });
    expect(res.statusCode).toBe(400);

    res = await app.inject({
      method: 'PUT',
      url: '/users/user2/binance-key',
      payload: { key: 'bkey2' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ key: 'bkey2' });

    res = await app.inject({ method: 'DELETE', url: '/users/user2/binance-key' });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: '/users/user2/binance-key' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
