import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import {
  errorResponse,
  lengthMessage,
  ERROR_MESSAGES,
} from '../util/errorMessages.js';
import reviewPortfolio from '../jobs/review-portfolio.js';
import { requireUserId } from '../util/auth.js';
import { fetchTotalBalanceUsd } from '../services/binance.js';
import { calculatePnl } from '../services/pnl.js';

export enum AgentStatus {
  Active = 'active',
  Inactive = 'inactive',
}

interface AgentRow {
  id: string;
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
  draft: number;
}

function toApi(row: AgentRow) {
  return {
    id: row.id,
    userId: row.user_id,
    model: row.model,
    status: row.status as AgentStatus,
    createdAt: row.created_at,
    name: row.name,
    tokenA: row.token_a,
    tokenB: row.token_b,
    targetAllocation: row.target_allocation,
    minTokenAAllocation: row.min_a_allocation,
    minTokenBAllocation: row.min_b_allocation,
    risk: row.risk,
    reviewInterval: row.review_interval,
    agentInstructions: row.agent_instructions,
    draft: !!row.draft,
  };
}

const baseSelect =
  'SELECT id, user_id, model, status, created_at, name, token_a, token_b, ' +
  'target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, ' +
  'agent_instructions, draft FROM agents';

function getAgent(id: string) {
  return db
    .prepare<[string], AgentRow>(`${baseSelect} WHERE id = ?`)
    .get(id) as AgentRow | undefined;
}

export default async function agentRoutes(app: FastifyInstance) {
  app.get('/agents', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const rows = db
      .prepare<[string], AgentRow>(`${baseSelect} WHERE user_id = ?`)
      .all(userId);
    return rows.map(toApi);
  });

  app.get('/agents/paginated', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
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
      .prepare(`${baseSelect} WHERE user_id = ? LIMIT ? OFFSET ?`)
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
      userId: string;
      model: string;
      name: string;
      tokenA: string;
      tokenB: string;
      targetAllocation: number;
      minTokenAAllocation: number;
      minTokenBAllocation: number;
      risk: string;
      reviewInterval: string;
      agentInstructions: string;
      draft: boolean;
    };
    const userId = requireUserId(req, reply);
    if (!userId) return;
    if (body.userId !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    if (body.model.length > 50)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('model', 50)));
    if (body.draft) {
      const dupDraft = db
        .prepare(
          `SELECT id, name FROM agents
             WHERE user_id = ? AND draft = 1 AND model = ? AND name = ?
               AND token_a = ? AND token_b = ? AND target_allocation = ?
               AND min_a_allocation = ? AND min_b_allocation = ?
               AND risk = ? AND review_interval = ? AND agent_instructions = ?`,
        )
        .get(
          body.userId,
          body.model,
          body.name,
          body.tokenA,
          body.tokenB,
          body.targetAllocation,
          body.minTokenAAllocation,
          body.minTokenBAllocation,
          body.risk,
          body.reviewInterval,
          body.agentInstructions,
        ) as { id: string; name: string } | undefined;
      if (dupDraft)
        return reply
          .code(400)
          .send(
            errorResponse(
              `identical draft already exists: ${dupDraft.name} (${dupDraft.id})`,
            ),
          );
    } else {
      const dupRows = db
        .prepare(
          `SELECT id, name, token_a, token_b FROM agents
             WHERE user_id = ? AND status = 'active' AND draft = 0
               AND (token_a IN (?, ?) OR token_b IN (?, ?))`,
        )
        .all(
          body.userId,
          body.tokenA,
          body.tokenB,
          body.tokenA,
          body.tokenB,
        ) as { id: string; name: string; token_a: string; token_b: string }[];
      if (dupRows.length) {
        const conflicts: { token: string; id: string; name: string }[] = [];
        for (const row of dupRows) {
          if (row.token_a === body.tokenA || row.token_b === body.tokenA)
            conflicts.push({ token: body.tokenA, id: row.id, name: row.name });
          if (row.token_a === body.tokenB || row.token_b === body.tokenB)
            conflicts.push({ token: body.tokenB, id: row.id, name: row.name });
        }
        const parts = conflicts.map(
          (c) => `${c.token} used by ${c.name} (${c.id})`,
        );
        const msg = `token${parts.length > 1 ? 's' : ''} ${parts.join(', ')} already used`;
        return reply.code(400).send(errorResponse(msg));
      }
    }
    let startBalance: number | null = null;
    if (!body.draft) {
      const userRow = db
        .prepare(
          'SELECT ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?',
        )
        .get(body.userId) as
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
        return reply.code(400).send(errorResponse('missing api keys'));
      try {
        startBalance = await fetchTotalBalanceUsd(userId);
      } catch {
        return reply
          .code(500)
          .send(errorResponse('failed to fetch balance'));
      }
      if (startBalance === null)
        return reply.code(500).send(errorResponse('failed to fetch balance'));
    }
    const id = randomUUID();
    const status = body.draft ? AgentStatus.Inactive : AgentStatus.Active;
    const createdAt = Date.now();
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, start_balance, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions, draft)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.userId,
      body.model,
      status,
      createdAt,
      startBalance,
      body.name,
      body.tokenA,
      body.tokenB,
      body.targetAllocation,
      body.minTokenAAllocation,
      body.minTokenBAllocation,
      body.risk,
      body.reviewInterval,
      body.agentInstructions,
      body.draft ? 1 : 0,
    );
    const row = getAgent(id)!;
    if (!body.draft) await reviewPortfolio(req.log, id);
    return toApi(row);
  });

  app.get('/agents/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const row = getAgent(id);
    if (!row)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    if (row.user_id !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    return toApi(row);
  });

  app.get('/agents/:id/pnl', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const perf = await calculatePnl(id, userId);
    if (!perf)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    return perf;
  });

  app.put('/agents/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const body = req.body as {
      userId: string;
      model: string;
      status: AgentStatus;
      name: string;
      tokenA: string;
      tokenB: string;
      targetAllocation: number;
      minTokenAAllocation: number;
      minTokenBAllocation: number;
      risk: string;
      reviewInterval: string;
      agentInstructions: string;
      draft: boolean;
    };
    const existing = db
      .prepare('SELECT user_id, draft FROM agents WHERE id = ?')
      .get(id) as { user_id: string; draft: number } | undefined;
    if (!existing)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    if (existing.user_id !== userId || body.userId !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    if (!body.draft) {
      const userRow = db
        .prepare(
          'SELECT ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?',
        )
        .get(body.userId) as
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
        return reply.code(400).send(errorResponse('missing api keys'));
    }
    if (body.draft) {
      const dupDraft = db
        .prepare(
          `SELECT id, name FROM agents
             WHERE user_id = ? AND draft = 1 AND id != ? AND model = ? AND name = ?
               AND token_a = ? AND token_b = ? AND target_allocation = ?
               AND min_a_allocation = ? AND min_b_allocation = ?
               AND risk = ? AND review_interval = ? AND agent_instructions = ?`,
        )
        .get(
          body.userId,
          id,
          body.model,
          body.name,
          body.tokenA,
          body.tokenB,
          body.targetAllocation,
          body.minTokenAAllocation,
          body.minTokenBAllocation,
          body.risk,
          body.reviewInterval,
          body.agentInstructions,
        ) as { id: string; name: string } | undefined;
      if (dupDraft)
        return reply
          .code(400)
          .send(
            errorResponse(
              `identical draft already exists: ${dupDraft.name} (${dupDraft.id})`,
            ),
          );
    } else if (body.status === AgentStatus.Active) {
      const dupRows = db
        .prepare(
          `SELECT id, name, token_a, token_b FROM agents
             WHERE user_id = ? AND status = 'active' AND draft = 0 AND id != ?
               AND (token_a IN (?, ?) OR token_b IN (?, ?))`,
        )
        .all(
          body.userId,
          id,
          body.tokenA,
          body.tokenB,
          body.tokenA,
          body.tokenB,
        ) as { id: string; name: string; token_a: string; token_b: string }[];
      if (dupRows.length) {
        const conflicts: { token: string; id: string; name: string }[] = [];
        for (const row of dupRows) {
          if (row.token_a === body.tokenA || row.token_b === body.tokenA)
            conflicts.push({ token: body.tokenA, id: row.id, name: row.name });
          if (row.token_a === body.tokenB || row.token_b === body.tokenB)
            conflicts.push({ token: body.tokenB, id: row.id, name: row.name });
        }
        const parts = conflicts.map(
          (c) => `${c.token} used by ${c.name} (${c.id})`,
        );
        const msg = `token${parts.length > 1 ? 's' : ''} ${parts.join(', ')} already used`;
        return reply.code(400).send(errorResponse(msg));
      }
    }
    const status = body.draft ? AgentStatus.Inactive : body.status;
    db.prepare(
      `UPDATE agents SET user_id = ?, model = ?, status = ?, name = ?, token_a = ?, token_b = ?, target_allocation = ?, min_a_allocation = ?, min_b_allocation = ?, risk = ?, review_interval = ?, agent_instructions = ?, draft = ? WHERE id = ?`
    ).run(
      body.userId,
      body.model,
      status,
      body.name,
      body.tokenA,
      body.tokenB,
      body.targetAllocation,
      body.minTokenAAllocation,
      body.minTokenBAllocation,
      body.risk,
      body.reviewInterval,
      body.agentInstructions,
      body.draft ? 1 : 0,
      id,
    );
    const row = getAgent(id)!;
    return toApi(row);
  });

  app.delete('/agents/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const existing = db
      .prepare('SELECT user_id FROM agents WHERE id = ?')
      .get(id) as { user_id: string } | undefined;
    if (!existing)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    if (existing.user_id !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return { ok: true };
  });
}
