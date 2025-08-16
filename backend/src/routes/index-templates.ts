import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { normalizeAllocations } from '../util/allocations.js';

interface IndexTemplateRow {
  id: string;
  user_id: string;
  token_a: string;
  token_b: string;
  target_allocation: number;
  min_a_allocation: number;
  min_b_allocation: number;
  risk: string;
  rebalance: string;
  model: string;
  agent_instructions: string;
}

function toApi(row: IndexTemplateRow) {
  return {
    id: row.id,
    userId: row.user_id,
    tokenA: row.token_a.toUpperCase(),
    tokenB: row.token_b.toUpperCase(),
    targetAllocation: row.target_allocation,
    minTokenAAllocation: row.min_a_allocation,
    minTokenBAllocation: row.min_b_allocation,
    risk: row.risk,
    rebalance: row.rebalance,
    model: row.model,
    agentInstructions: row.agent_instructions,
  };
}

export default async function indexTemplateRoutes(app: FastifyInstance) {
  app.get('/index-templates', async () => {
    const rows = db.prepare<[], IndexTemplateRow>('SELECT * FROM index_templates').all();
    return rows.map(toApi);
  });

  app.get('/index-templates/paginated', async (req) => {
    const {
      page = '1',
      pageSize = '10',
      userId,
    } = req.query as { page?: string; pageSize?: string; userId?: string };
    const p = Math.max(parseInt(page, 10), 1);
    const ps = Math.max(parseInt(pageSize, 10), 1);
    const offset = (p - 1) * ps;
    const params: any[] = [];
    let where = '';
    if (userId) {
      where = 'WHERE user_id = ?';
      params.push(userId);
    }
    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM index_templates ${where}`)
      .get(...params) as { count: number };
    const rows = db
      .prepare(`SELECT * FROM index_templates ${where} LIMIT ? OFFSET ?`)
      .all(...params, ps, offset) as IndexTemplateRow[];
    return {
      items: rows.map(toApi),
      total: totalRow.count,
      page: p,
      pageSize: ps,
    };
  });

  app.post('/index-templates', async (req) => {
    const body = req.body as {
      userId: string;
      tokenA: string;
      tokenB: string;
      targetAllocation: number;
      minTokenAAllocation: number;
      minTokenBAllocation: number;
      risk: string;
      rebalance: string;
      model: string;
      agentInstructions: string;
    };
    const id = randomUUID();
    const tokenA = body.tokenA.toUpperCase();
    const tokenB = body.tokenB.toUpperCase();
    const { targetAllocation, minTokenAAllocation, minTokenBAllocation } = normalizeAllocations(
      body.targetAllocation,
      body.minTokenAAllocation,
      body.minTokenBAllocation
    );
    db.prepare(
      `INSERT INTO index_templates (id, user_id, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, rebalance, model, agent_instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.userId,
      tokenA,
      tokenB,
      targetAllocation,
      minTokenAAllocation,
      minTokenBAllocation,
      body.risk,
      body.rebalance,
      body.model,
      body.agentInstructions
    );
    return {
      id,
      ...body,
      tokenA,
      tokenB,
      targetAllocation,
      minTokenAAllocation,
      minTokenBAllocation,
    };
  });

  app.get('/index-templates/:id', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT * FROM index_templates WHERE id = ?')
      .get(id) as IndexTemplateRow | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    return toApi(row);
  });

  app.put('/index-templates/:id', async (req, reply) => {
    const id = (req.params as any).id;
    const body = req.body as {
      userId: string;
      tokenA: string;
      tokenB: string;
      targetAllocation: number;
      minTokenAAllocation: number;
      minTokenBAllocation: number;
      risk: string;
      rebalance: string;
      model: string;
      agentInstructions: string;
    };
    const existing = db
      .prepare('SELECT id FROM index_templates WHERE id = ?')
      .get(id) as { id: string } | undefined;
    if (!existing) return reply.code(404).send({ error: 'not found' });
    const tokenA = body.tokenA.toUpperCase();
    const tokenB = body.tokenB.toUpperCase();
    const { targetAllocation, minTokenAAllocation, minTokenBAllocation } = normalizeAllocations(
      body.targetAllocation,
      body.minTokenAAllocation,
      body.minTokenBAllocation
    );
    db.prepare(
      `UPDATE index_templates SET user_id = ?, token_a = ?, token_b = ?, target_allocation = ?, min_a_allocation = ?, min_b_allocation = ?, risk = ?, rebalance = ?, model = ?, agent_instructions = ? WHERE id = ?`
    ).run(
      body.userId,
      tokenA,
      tokenB,
      targetAllocation,
      minTokenAAllocation,
      minTokenBAllocation,
      body.risk,
      body.rebalance,
      body.model,
      body.agentInstructions,
      id
    );
    const row = db
      .prepare('SELECT * FROM index_templates WHERE id = ?')
      .get(id) as IndexTemplateRow;
    return toApi(row);
  });

  app.delete('/index-templates/:id', async (req, reply) => {
    const id = (req.params as any).id;
    const res = db.prepare('DELETE FROM index_templates WHERE id = ?').run(id);
    if (res.changes === 0) return reply.code(404).send({ error: 'not found' });
    return { ok: true };
  });
}

