import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';

export enum IndexAgentStatus {
  Active = 'active',
  Inactive = 'inactive',
}

interface IndexAgentRow {
  id: string;
  template_id: string;
  user_id: string;
  status: string;
  created_at: number;
}

function toApi(row: IndexAgentRow) {
  return {
    id: row.id,
    templateId: row.template_id,
    userId: row.user_id,
    status: row.status as IndexAgentStatus,
    createdAt: row.created_at,
  };
}

export default async function indexAgentRoutes(app: FastifyInstance) {
  app.get('/index-agents', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId)
      return reply.code(403).send({ error: 'forbidden' });
    const rows = db
      .prepare<[], IndexAgentRow>('SELECT * FROM index_agents WHERE user_id = ?')
      .all(userId);
    return rows.map(toApi);
  });

  app.get('/index-agents/paginated', async (req, reply) => {
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
      .prepare('SELECT COUNT(*) as count FROM index_agents WHERE user_id = ?')
      .get(userId) as { count: number };
    const rows = db
      .prepare('SELECT * FROM index_agents WHERE user_id = ? LIMIT ? OFFSET ?')
      .all(userId, ps, offset) as IndexAgentRow[];
    return {
      items: rows.map(toApi),
      total: totalRow.count,
      page: p,
      pageSize: ps,
    };
  });

  app.post('/index-agents', async (req, reply) => {
    const body = req.body as {
      templateId: string;
      userId: string;
      status?: IndexAgentStatus;
    };
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId || body.userId !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    const template = db
      .prepare('SELECT user_id FROM index_templates WHERE id = ?')
      .get(body.templateId) as { user_id: string } | undefined;
    if (!template || template.user_id !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    const id = randomUUID();
    const status = body.status ?? IndexAgentStatus.Inactive;
    const createdAt = Date.now();
    db.prepare(
      `INSERT INTO index_agents (id, template_id, user_id, status, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, body.templateId, body.userId, status, createdAt);
    return {
      id,
      templateId: body.templateId,
      userId: body.userId,
      status,
      createdAt,
    };
  });

  app.get('/index-agents/:id', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT * FROM index_agents WHERE id = ?')
      .get(id) as IndexAgentRow | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    if (!userId || row.user_id !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    return toApi(row);
  });

  app.put('/index-agents/:id', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    const id = (req.params as any).id;
    const body = req.body as {
      templateId: string;
      userId: string;
      status: IndexAgentStatus;
    };
    const existing = db
      .prepare('SELECT * FROM index_agents WHERE id = ?')
      .get(id) as IndexAgentRow | undefined;
    if (!existing) return reply.code(404).send({ error: 'not found' });
    if (!userId || existing.user_id !== userId || body.userId !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    const template = db
      .prepare('SELECT user_id FROM index_templates WHERE id = ?')
      .get(body.templateId) as { user_id: string } | undefined;
    if (!template || template.user_id !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    db.prepare(
      `UPDATE index_agents SET template_id = ?, user_id = ?, status = ? WHERE id = ?`
    ).run(body.templateId, body.userId, body.status, id);
    const row = db
      .prepare('SELECT * FROM index_agents WHERE id = ?')
      .get(id) as IndexAgentRow;
    return toApi(row);
  });

  app.delete('/index-agents/:id', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    const id = (req.params as any).id;
    const existing = db
      .prepare('SELECT user_id FROM index_agents WHERE id = ?')
      .get(id) as { user_id: string } | undefined;
    if (!existing) return reply.code(404).send({ error: 'not found' });
    if (!userId || existing.user_id !== userId)
      return reply.code(403).send({ error: 'forbidden' });
    db.prepare('DELETE FROM index_agents WHERE id = ?').run(id);
    return { ok: true };
  });
}

