import { describe, it, expect } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
import buildServer from '../src/server.js';

migrate();

function addUser(id: string) {
  db.prepare('INSERT INTO users (id) VALUES (?)').run(id);
}

describe('agent exec log routes', () => {
  it('returns paginated logs and enforces ownership', async () => {
    const app = await buildServer();
    addUser('u1');
    addUser('u2');
    const agentId = 'a1';
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'A', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'inst')`
    ).run(agentId, 'u1');
    for (let i = 0; i < 3; i++) {
      db.prepare(
        'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)'
      ).run(`log${i}`, agentId, `log-${i}`, i);
    }
    let res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=2`,
      headers: { 'x-user-id': 'u1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(res.json().items).toHaveLength(2);
    res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=2`,
      headers: { 'x-user-id': 'u2' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('parses openai response text field', async () => {
    const app = await buildServer();
    addUser('u3');
    const agentId = 'a2';
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'A', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'inst')`
    ).run(agentId, 'u3');
    const aiLog = JSON.stringify({
      object: 'response',
      output: [
        {
          type: 'message',
          id: 'msg_0',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: '{"result":{"rebalance":false,"shortReport":"ok"}}',
            },
          ],
        },
      ],
    });
    db.prepare(
      'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)'
    ).run('log-new', agentId, aiLog, 0);
    const res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=10`,
      headers: { 'x-user-id': 'u3' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items[0]).toMatchObject({
      log: '{"result":{"rebalance":false,"shortReport":"ok"}}',
      response: { rebalance: false, shortReport: 'ok' },
    });
    await app.close();
  });
});
