import { describe, it, expect, vi } from 'vitest';
import { db } from '../src/db/index.js';
import buildServer from '../src/server.js';

function addUser(id: string) {
  db.prepare('INSERT INTO users (id) VALUES (?)').run(id);
}

const reviewAgentMock = vi.fn<(
  log: unknown,
  agentId: string,
) => Promise<unknown>>(() => Promise.resolve());
vi.mock('../src/jobs/review-portfolio.js', () => ({ reviewAgent: reviewAgentMock }));

describe('manual review endpoint', () => {
  it('triggers portfolio review', async () => {
    const app = await buildServer();
    addUser('u1');
    const agentId = 'a1';
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'A', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
    ).run(agentId, 'u1');

    const res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentId}/review`,
      headers: { 'x-user-id': 'u1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(reviewAgentMock).toHaveBeenCalledTimes(1);
    expect(reviewAgentMock.mock.calls[0][1]).toBe(agentId);
    await app.close();
  });

  it('returns error when agent is already reviewing', async () => {
    const app = await buildServer();
    addUser('u2');
    const agentId = 'b1';
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'A2', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
    ).run(agentId, 'u2');
    reviewAgentMock.mockRejectedValueOnce(
      new Error('Agent is already reviewing portfolio'),
    );
    const res = await app.inject({
      method: 'POST',
      url: `/api/agents/${agentId}/review`,
      headers: { 'x-user-id': 'u2' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Agent is already reviewing portfolio' });
    await app.close();
  });
});
