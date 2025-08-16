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
    db.prepare(
      'INSERT INTO users (id, ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc) VALUES (?, ?, ?, ?)'
    ).run('user1', 'a', 'b', 'c');
    db.prepare(
      `INSERT INTO index_templates (id, user_id, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, rebalance, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl1', 'user1', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'prompt');

    const payload = { templateId: 'tmpl1', userId: 'user1', model: 'gpt-5', status: 'inactive' };

    let res = await app.inject({
      method: 'POST',
      url: '/api/index-agents',
      headers: { 'x-user-id': 'user1' },
      payload,
    });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;

    res = await app.inject({
      method: 'GET',
      url: `/api/index-agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...payload });

    res = await app.inject({
      method: 'GET',
      url: '/api/index-agents',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);

    res = await app.inject({
      method: 'GET',
      url: '/api/index-agents/paginated?page=1&pageSize=10',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);

    const update = { templateId: 'tmpl1', userId: 'user1', model: 'o3', status: 'active' };
    res = await app.inject({
      method: 'PUT',
      url: `/api/index-agents/${id}`,
      headers: { 'x-user-id': 'user1' },
      payload: update,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...update });

    res = await app.inject({
      method: 'DELETE',
      url: `/api/index-agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);

    res = await app.inject({
      method: 'GET',
      url: `/api/index-agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('enforces user ownership', async () => {
    const app = await buildServer();
    db.prepare(
      'INSERT INTO users (id, ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc) VALUES (?, ?, ?, ?)'
    ).run('user2', 'a', 'b', 'c');
    db.prepare(
      'INSERT INTO users (id, ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc) VALUES (?, ?, ?, ?)'
    ).run('user3', 'a', 'b', 'c');
    db.prepare(
      `INSERT INTO index_templates (id, user_id, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, rebalance, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl2', 'user2', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'prompt');
    db.prepare(
      `INSERT INTO index_templates (id, user_id, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, rebalance, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl3', 'user3', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'prompt');

    let res = await app.inject({
      method: 'POST',
      url: '/api/index-agents',
      headers: { 'x-user-id': 'user2' },
      payload: { templateId: 'tmpl2', userId: 'user2', model: 'm1', status: 'inactive' },
    });
    const id1 = res.json().id as string;

    res = await app.inject({
      method: 'POST',
      url: '/api/index-agents',
      headers: { 'x-user-id': 'user3' },
      payload: { templateId: 'tmpl3', userId: 'user3', model: 'm1', status: 'inactive' },
    });
    const id2 = res.json().id as string;

    res = await app.inject({
      method: 'GET',
      url: '/api/index-agents',
      headers: { 'x-user-id': 'user2' },
    });
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].id).toBe(id1);

    res = await app.inject({
      method: 'GET',
      url: `/api/index-agents/${id2}`,
      headers: { 'x-user-id': 'user2' },
    });
    expect(res.statusCode).toBe(403);

    res = await app.inject({
      method: 'POST',
      url: '/api/index-agents',
      headers: { 'x-user-id': 'user2' },
      payload: { templateId: 'tmpl2', userId: 'user3', model: 'm1', status: 'inactive' },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

