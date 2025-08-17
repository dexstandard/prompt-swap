import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { errorResponse, lengthMessage, ERROR_MESSAGES } from '../util/errorMessages.js';

export enum AgentStatus {
  Active = 'active',
  Inactive = 'inactive',
}

interface AgentRow {
  id: string;
  template_id: string;
  user_id: string;
  model: string;
  status: string;
  created_at: number;
  name: string;
  token_a: string;
  token_b: string;
  target_allocation: number;
  min_a_allocation: number;
  min_b_allocation: number;
  risk: string;
  review_interval: string;
  agent_instructions: string;
}

function toApi(row: AgentRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    userId: row.user_id,
    model: row.model,
    status: row.status as AgentStatus,
    createdAt: row.created_at,
    template: {
      id: row.template_id,
      name: row.name,
      tokenA: row.token_a,
      tokenB: row.token_b,
      targetAllocation: row.target_allocation,
      minTokenAAllocation: row.min_a_allocation,
      minTokenBAllocation: row.min_b_allocation,
      risk: row.risk,
      reviewInterval: row.review_interval,
      agentInstructions: row.agent_instructions,
    },
  };
}

const baseSelect =
  'SELECT a.id, a.template_id, a.user_id, a.model, a.status, a.created_at, ' +
  't.name, t.token_a, t.token_b, t.target_allocation, t.min_a_allocation, t.min_b_allocation, ' +
  't.risk, t.review_interval, t.agent_instructions FROM agents a JOIN agent_templates t ON a.template_id = t.id';

function getAgent(id: string) {
  return db
    .prepare<[string], AgentRow>(`${baseSelect} WHERE a.id = ?`)
    .get(id) as AgentRow | undefined;
}

export default async function agentRoutes(app: FastifyInstance) {
  app.get('/agents', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId)
      return reply.code(403).send({ error: 'forbidden' });
    const rows = db
      .prepare<[string], AgentRow>(`${baseSelect} WHERE a.user_id = ?`)
      .all(userId);
    return rows.map(toApi);
  });

  app.get('/agents/paginated', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId)
      return reply.code(403).send({ error: 'forbidden' });
    const { page = '1', pageSize = '10' } = req.query as {
      page?: string;
      pageSize?: string;
    };
    const p = Math.max(parseInt(page, 10), 1);
    const ps = Math.max(parseInt(pageSize, 10), 1);
    const offset = (p - 1) * ps;
    const totalRow = db
      .prepare('SELECT COUNT(*) as count FROM agents WHERE user_id = ?')
      .get(userId) as { count: number };
    const rows = db
      .prepare(`${baseSelect} WHERE a.user_id = ? LIMIT ? OFFSET ?`)
      .all(userId, ps, offset) as AgentRow[];
    return {
      items: rows.map(toApi),
      total: totalRow.count,
      page: p,
      pageSize: ps,
    };
  });

  app.post('/agents', async (req, reply) => {
    const body = req.body as {
      templateId: string;
      userId: string;
      model: string;
      status?: AgentStatus;
    };
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId || body.userId !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    const template = db
      .prepare('SELECT user_id FROM agent_templates WHERE id = ?')
      .get(body.templateId) as { user_id: string } | undefined;
    if (!template || template.user_id !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    const existing = db
      .prepare('SELECT id FROM agents WHERE template_id = ?')
      .get(body.templateId) as { id: string } | undefined;
    if (existing)
      return reply
        .code(400)
        .send(errorResponse(ERROR_MESSAGES.agentExists));
    if (body.model.length > 50)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('model', 50)));
    const userRow = db
      .prepare(
        'SELECT ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
      )
      .get(userId) as
      | {
          ai_api_key_enc?: string;
          binance_api_key_enc?: string;
          binance_api_secret_enc?: string;
        }
      | undefined;
    if (
      !userRow?.ai_api_key_enc ||
      !userRow.binance_api_key_enc ||
      !userRow.binance_api_secret_enc
    )
      return reply.code(400).send({ error: 'missing api keys' });
    const id = randomUUID();
    const status = body.status ?? AgentStatus.Inactive;
    const createdAt = Date.now();
    db.prepare(
      `INSERT INTO agents (id, template_id, user_id, model, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, body.templateId, body.userId, body.model, status, createdAt);
    const row = getAgent(id)!;
    return toApi(row);
  });

  app.get('/agents/:id', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    const id = (req.params as any).id;
    const row = getAgent(id);
    if (!row) return reply.code(404).send({ error: 'not found' });
    if (!userId || row.user_id !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    return toApi(row);
  });

  app.put('/agents/:id', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    const id = (req.params as any).id;
    const body = req.body as {
      templateId: string;
      userId: string;
      model: string;
      status: AgentStatus;
    };
    const existing = db
      .prepare('SELECT user_id FROM agents WHERE id = ?')
      .get(id) as { user_id: string } | undefined;
    if (!existing) return reply.code(404).send({ error: 'not found' });
    if (!userId || existing.user_id !== userId || body.userId !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    const template = db
      .prepare('SELECT user_id FROM agent_templates WHERE id = ?')
      .get(body.templateId) as { user_id: string } | undefined;
    if (!template || template.user_id !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    db.prepare(
      `UPDATE agents SET template_id = ?, user_id = ?, model = ?, status = ? WHERE id = ?`
    ).run(body.templateId, body.userId, body.model, body.status, id);
    const row = getAgent(id)!;
    return toApi(row);
  });

  app.delete('/agents/:id', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    const id = (req.params as any).id;
    const existing = db
      .prepare('SELECT user_id FROM agents WHERE id = ?')
      .get(id) as { user_id: string } | undefined;
    if (!existing) return reply.code(404).send({ error: 'not found' });
    if (!userId || existing.user_id !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return { ok: true };
  });
}

