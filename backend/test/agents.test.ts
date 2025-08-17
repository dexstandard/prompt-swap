import { describe, it, expect } from 'vitest';
import {
  ERROR_MESSAGES,
  lengthMessage,
  errorResponse,
} from '../src/util/errorMessages.js';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';

migrate();

describe('agent routes', () => {
  it('performs CRUD operations', async () => {
    const app = await buildServer();
    db.prepare(
      'INSERT INTO users (id, ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc) VALUES (?, ?, ?, ?)'
    ).run('user1', 'a', 'b', 'c');
    db.prepare(
      `INSERT INTO agent_templates (id, user_id, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl1', 'user1', 'T1', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'prompt');

    const payload = { templateId: 'tmpl1', userId: 'user1', model: 'gpt-5' };

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user1' },
      payload,
    });
    expect(res.statusCode).toBe(200);
    const id = res.json().id as string;
    expect(res.json().status).toBe('active');
    expect(res.json().template).toMatchObject({ tokenA: 'BTC', tokenB: 'ETH' });

    const logRow = db
      .prepare('SELECT COUNT(*) as c FROM agent_exec_log WHERE agent_id = ?')
      .get(id) as { c: number };
    expect(logRow.c).toBe(1);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id,
      ...payload,
      status: 'active',
      template: { tokenA: 'BTC', tokenB: 'ETH' },
    });

    res = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].template).toMatchObject({ tokenA: 'BTC', tokenB: 'ETH' });

    res = await app.inject({
      method: 'GET',
      url: '/api/agents/paginated?page=1&pageSize=10',
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].template).toMatchObject({ tokenA: 'BTC', tokenB: 'ETH' });

    const update = { templateId: 'tmpl1', userId: 'user1', model: 'o3', status: 'active' };
    res = await app.inject({
      method: 'PUT',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
      payload: update,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, ...update, template: { tokenA: 'BTC', tokenB: 'ETH' } });

    res = await app.inject({
      method: 'DELETE',
      url: `/api/agents/${id}`,
      headers: { 'x-user-id': 'user1' },
    });
    expect(res.statusCode).toBe(200);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id}`,
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
      `INSERT INTO agent_templates (id, user_id, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl2', 'user2', 'T2', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'prompt');
    db.prepare(
      `INSERT INTO agent_templates (id, user_id, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl3', 'user3', 'T3', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'prompt');

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user2' },
      payload: { templateId: 'tmpl2', userId: 'user2', model: 'm1' },
    });
    const id1 = res.json().id as string;

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user3' },
      payload: { templateId: 'tmpl3', userId: 'user3', model: 'm1' },
    });
    const id2 = res.json().id as string;

    res = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { 'x-user-id': 'user2' },
    });
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].id).toBe(id1);

    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${id2}`,
      headers: { 'x-user-id': 'user2' },
    });
    expect(res.statusCode).toBe(403);

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user2' },
      payload: { templateId: 'tmpl2', userId: 'user3', model: 'm1' },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('prevents multiple agents for a template', async () => {
    const app = await buildServer();
    db.prepare(
      'INSERT INTO users (id, ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc) VALUES (?, ?, ?, ?)'
    ).run('user4', 'a', 'b', 'c');
    db.prepare(
      `INSERT INTO agent_templates (id, user_id, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl4', 'user4', 'T4', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'prompt');
    db.prepare(
      `INSERT INTO agent_templates (id, user_id, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('tmpl5', 'user4', 'T5', 'BTC', 'SOL', 60, 10, 20, 'low', '1h', 'prompt');

    let res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user4' },
      payload: { templateId: 'tmpl4', userId: 'user4', model: 'm1' },
    });
    expect(res.statusCode).toBe(200);

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user4' },
      payload: { templateId: 'tmpl4', userId: 'user4', model: 'm1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject(errorResponse(ERROR_MESSAGES.agentExists));

    res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { 'x-user-id': 'user4' },
      payload: {
        templateId: 'tmpl5',
        userId: 'user4',
        model: 'x'.repeat(51),
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject(errorResponse(lengthMessage('model', 50)));

    await app.close();
  });
});

