import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';

interface PortfolioRow {
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

function toApi(row: PortfolioRow) {
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
    const rows = db.prepare<[], PortfolioRow>('SELECT * FROM portfolios').all();
    return rows.map(toApi);
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
      `INSERT INTO portfolios (id, user_id, token_a, token_b, token_a_pct, token_b_pct, risk, rebalance, system_prompt)
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
      .prepare('SELECT * FROM portfolios WHERE id = ?')
      .get(id) as PortfolioRow | undefined;
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
      .prepare('SELECT id FROM portfolios WHERE id = ?')
      .get(id) as { id: string } | undefined;
    if (!existing) return reply.code(404).send({ error: 'not found' });
    db.prepare(
      `UPDATE portfolios SET user_id = ?, token_a = ?, token_b = ?, token_a_pct = ?, token_b_pct = ?, risk = ?, rebalance = ?, system_prompt = ? WHERE id = ?`
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
    const res = db.prepare('DELETE FROM portfolios WHERE id = ?').run(id);
    if (res.changes === 0) return reply.code(404).send({ error: 'not found' });
    return { ok: true };
  });
}
