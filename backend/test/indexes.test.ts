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
      tokenA: 'BTC',
      tokenB: 'ETH',
      targetAllocation: 60,
      minTokenAAllocation: 10,
      minTokenBAllocation: 20,
      risk: 'low',
      rebalance: '1h',
      model: 'gpt-5',
      systemPrompt: 'prompt',
    };

    let res = await app.inject({ method: 'POST', url: '/api/indexes', payload });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;

    res = await app.inject({ method: 'GET', url: `/api/indexes/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...payload, tvl: 0 });

    res = await app.inject({ method: 'GET', url: '/api/indexes' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);

    res = await app.inject({
      method: 'GET',
      url: '/api/indexes/paginated?page=1&pageSize=10&userId=user1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    const update = { ...payload, targetAllocation: 70, risk: 'medium', model: 'o3' };
    res = await app.inject({ method: 'PUT', url: `/api/indexes/${id}`, payload: update });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...update, tvl: 0 });

    res = await app.inject({ method: 'DELETE', url: `/api/indexes/${id}` });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: `/api/indexes/${id}` });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('auto-corrects allocation inputs', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user2');

    const base = {
      userId: 'user2',
      tokenA: 'BTC',
      tokenB: 'ETH',
      risk: 'low',
      rebalance: '1h',
      model: 'gpt-5',
      systemPrompt: 'prompt',
    };

    let res = await app.inject({
      method: 'POST',
      url: '/api/indexes',
      payload: { ...base, targetAllocation: 50, minTokenAAllocation: 80, minTokenBAllocation: 30 },
    });
    expect(res.json()).toMatchObject({ targetAllocation: 70, minTokenAAllocation: 70, minTokenBAllocation: 30 });

    res = await app.inject({
      method: 'POST',
      url: '/api/indexes',
      payload: { ...base, targetAllocation: 50, minTokenAAllocation: 20, minTokenBAllocation: 90 },
    });
    expect(res.json()).toMatchObject({ targetAllocation: 20, minTokenAAllocation: 20, minTokenBAllocation: 80 });

    res = await app.inject({
      method: 'POST',
      url: '/api/indexes',
      payload: { ...base, targetAllocation: 5, minTokenAAllocation: 10, minTokenBAllocation: 10 },
    });
    expect(res.json()).toMatchObject({ targetAllocation: 10, minTokenAAllocation: 10, minTokenBAllocation: 10 });

    res = await app.inject({
      method: 'POST',
      url: '/api/indexes',
      payload: { ...base, targetAllocation: 95, minTokenAAllocation: 10, minTokenBAllocation: 10 },
    });
    expect(res.json()).toMatchObject({ targetAllocation: 90, minTokenAAllocation: 10, minTokenBAllocation: 10 });

    await app.close();
  });
});
