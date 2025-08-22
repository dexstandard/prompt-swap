import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../src/db/index.js';
import buildServer from '../src/server.js';

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
        `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
         VALUES (?, ?, 'gpt', 'active', 0, 'A', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
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

  it('parses OpenAI response content JSON into {response}', async () => {
    const app = await buildServer();
    addUser('u3');

    const agentId = 'a2';
    db.prepare(
        `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
         VALUES (?, ?, 'gpt', 'active', 0, 'A', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
    ).run(agentId, 'u3');

    const aiLog = readFileSync(
        join(__dirname, 'fixtures/real-openai-log.json'),
        'utf8',
    );

    db.prepare(
        'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)',
    ).run('log-new', agentId, aiLog, 0);

    const res = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentId}/exec-log?page=1&pageSize=10`,
      headers: { 'x-user-id': 'u3' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // The parser should put the assistant message's JSON string into `log`
    expect(typeof body.items[0].log).toBe('string');
    expect(body.items[0].log).toContain('"result"');
    expect(body.items[0].log).toContain('"rebalance"');

    // And it should normalize `response`
    expect(body.items[0].response).toMatchObject({
      rebalance: true,
      newAllocation: 70, // matches the provided fixture
    });
    expect(typeof body.items[0].response.shortReport).toBe('string');
    expect(body.items[0].response.shortReport.length).toBeGreaterThan(0);

    await app.close();
  });
});
