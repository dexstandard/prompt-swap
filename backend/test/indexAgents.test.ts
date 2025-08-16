import { describe, it, expect } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';

migrate();

describe('index agent routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    db.prepare('INSERT INTO users (id) VALUES (?)').run('user1');
    db.prepare(
      `INSERT INTO index_templates (id, user_id, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, rebalance, model, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl1', 'user1', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'gpt-5', 'prompt');

    const payload = { templateId: 'tmpl1', userId: 'user1', status: 'idle' };

    let res = await app.inject({ method: 'POST', url: '/api/index-agents', payload });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;

    res = await app.inject({ method: 'GET', url: `/api/index-agents/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...payload });

    res = await app.inject({ method: 'GET', url: '/api/index-agents' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);

    res = await app.inject({
      method: 'GET',
      url: '/api/index-agents/paginated?page=1&pageSize=10&userId=user1',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    const update = { templateId: 'tmpl1', userId: 'user1', status: 'running' };
    res = await app.inject({ method: 'PUT', url: `/api/index-agents/${id}`, payload: update });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...update });

    res = await app.inject({ method: 'DELETE', url: `/api/index-agents/${id}` });
    expect(res.statusCode).toBe(200);

    res = await app.inject({ method: 'GET', url: `/api/index-agents/${id}` });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});

