import { describe, it, expect } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';

migrate();

describe('index routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user1');

    const payload = {
      userId: 'user1',
      tokenA: 'btc',
      tokenB: 'eth',
      tokenAPercent: 60,
      tokenBPercent: 40,
      risk: 'low',
      rebalance: '1h',
      model: 'gpt-5',
      systemPrompt: 'prompt',
    };

    let res = await app.inject({ method: 'POST', url: '/indexes', payload });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;

    res = await app.inject({ method: 'GET', url: `/indexes/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...payload, tvl: 0 });

    res = await app.inject({ method: 'GET', url: '/indexes' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);

    res = await app.inject({
      method: 'GET',
      url: '/indexes/paginated?page=1&pageSize=10&userId=user1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    const update = { ...payload, tokenAPercent: 70, tokenBPercent: 30, risk: 'medium', model: 'o3' };
    res = await app.inject({ method: 'PUT', url: `/indexes/${id}`, payload: update });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...update, tvl: 0 });

    res = await app.inject({ method: 'DELETE', url: `/indexes/${id}` });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: `/indexes/${id}` });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
