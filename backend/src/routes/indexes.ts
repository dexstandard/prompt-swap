import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';

interface TokenIndexRow {
  id: string;
  user_id: string;
  token_a: string;
  token_b: string;
  token_a_pct: number;
  token_b_pct: number;
  risk: string;
  rebalance: string;
  system_prompt: string;
}

function toApi(row: TokenIndexRow) {
  return {
    id: row.id,
    userId: row.user_id,
    tokenA: row.token_a,
    tokenB: row.token_b,
    tokenAPercent: row.token_a_pct,
    tokenBPercent: row.token_b_pct,
    risk: row.risk,
    rebalance: row.rebalance,
    systemPrompt: row.system_prompt,
  };
}

export default async function indexRoutes(app: FastifyInstance) {
  app.get('/indexes', async () => {
    const rows = db.prepare<[], TokenIndexRow>('SELECT * FROM token_indexes').all();
    return rows.map(toApi);
  });

  app.get('/indexes/paginated', async (req) => {
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
      .prepare(`SELECT COUNT(*) as count FROM token_indexes ${where}`)
      .get(...params) as { count: number };
    const rows = db
      .prepare(`SELECT * FROM token_indexes ${where} LIMIT ? OFFSET ?`)
      .all(...params, ps, offset) as TokenIndexRow[];
    return {
      items: rows.map(toApi),
      total: totalRow.count,
      page: p,
      pageSize: ps,
    };
  });

  app.post('/indexes', async (req) => {
    const body = req.body as {
      userId: string;
      tokenA: string;
      tokenB: string;
      tokenAPercent: number;
      tokenBPercent: number;
      risk: string;
      rebalance: string;
      systemPrompt: string;
    };
    const id = randomUUID();
    db.prepare(
      `INSERT INTO token_indexes (id, user_id, token_a, token_b, token_a_pct, token_b_pct, risk, rebalance, system_prompt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.userId,
      body.tokenA,
      body.tokenB,
      body.tokenAPercent,
      body.tokenBPercent,
      body.risk,
      body.rebalance,
      body.systemPrompt
    );
    return { id, ...body };
  });

  app.get('/indexes/:id', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT * FROM token_indexes WHERE id = ?')
      .get(id) as TokenIndexRow | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    return toApi(row);
  });

  app.put('/indexes/:id', async (req, reply) => {
    const id = (req.params as any).id;
    const body = req.body as {
      userId: string;
      tokenA: string;
      tokenB: string;
      tokenAPercent: number;
      tokenBPercent: number;
      risk: string;
      rebalance: string;
      systemPrompt: string;
    };
    const existing = db
      .prepare('SELECT id FROM token_indexes WHERE id = ?')
      .get(id) as { id: string } | undefined;
    if (!existing) return reply.code(404).send({ error: 'not found' });
    db.prepare(
      `UPDATE token_indexes SET user_id = ?, token_a = ?, token_b = ?, token_a_pct = ?, token_b_pct = ?, risk = ?, rebalance = ?, system_prompt = ? WHERE id = ?`
    ).run(
      body.userId,
      body.tokenA,
      body.tokenB,
      body.tokenAPercent,
      body.tokenBPercent,
      body.risk,
      body.rebalance,
      body.systemPrompt,
      id
    );
    return { id, ...body };
  });

  app.delete('/indexes/:id', async (req, reply) => {
    const id = (req.params as any).id;
    const res = db.prepare('DELETE FROM token_indexes WHERE id = ?').run(id);
    if (res.changes === 0) return reply.code(404).send({ error: 'not found' });
    return { ok: true };
  });
}
