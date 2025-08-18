import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import {
  errorResponse,
  lengthMessage,
  ERROR_MESSAGES,
} from '../util/errorMessages.js';
import { requireUserId } from '../util/auth.js';
import reviewPortfolio from '../jobs/review-portfolio.js';
import { fetchTotalBalanceUsd } from '../services/binance.js';
import { calculatePnl } from '../services/pnl.js';
import { normalizeAllocations } from '../util/allocations.js';

export enum AgentStatus {
  Active = 'active',
  Inactive = 'inactive',
}

const MAX_MODEL_LENGTH = 50;
const MAX_NAME_LENGTH = 50;
const MAX_TOKEN_LENGTH = 10;
const MAX_RISK_LENGTH = 20;
const MAX_REVIEW_INTERVAL_LENGTH = 20;
const MAX_INSTRUCTIONS_LENGTH = 2000;

interface AgentRow {
  id: string;
  user_id: string;
  model: string | null;
  status: string;
  created_at: number;
  start_balance: number | null;
  name: string | null;
  token_a: string | null;
  token_b: string | null;
  target_allocation: number | null;
  min_a_allocation: number | null;
  min_b_allocation: number | null;
  risk: string | null;
  review_interval: string | null;
  agent_instructions: string | null;
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
  };
}

const baseSelect = 'SELECT * FROM agents';

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
    const body = req.body as any;
    const userId = requireUserId(req, reply);
    if (!userId) return;
    if (body.userId !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));

    const id = randomUUID();
    const createdAt = Date.now();
    const status: AgentStatus = body.status || AgentStatus.Inactive;

    const tokenA = body.tokenA ? body.tokenA.toUpperCase() : null;
    const tokenB = body.tokenB ? body.tokenB.toUpperCase() : null;

    if (body.model && body.model.length > MAX_MODEL_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('model', MAX_MODEL_LENGTH)));
    if (body.name && body.name.length > MAX_NAME_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('name', MAX_NAME_LENGTH)));
    if (tokenA && tokenA.length > MAX_TOKEN_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('tokenA', MAX_TOKEN_LENGTH)));
    if (tokenB && tokenB.length > MAX_TOKEN_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('tokenB', MAX_TOKEN_LENGTH)));
    if (body.risk && body.risk.length > MAX_RISK_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('risk', MAX_RISK_LENGTH)));
    if (body.reviewInterval && body.reviewInterval.length > MAX_REVIEW_INTERVAL_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('reviewInterval', MAX_REVIEW_INTERVAL_LENGTH)));
    if (body.agentInstructions && body.agentInstructions.length > MAX_INSTRUCTIONS_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('agentInstructions', MAX_INSTRUCTIONS_LENGTH)));

    let targetAllocation = body.targetAllocation ?? null;
    let minTokenAAllocation = body.minTokenAAllocation ?? null;
    let minTokenBAllocation = body.minTokenBAllocation ?? null;
    if (
      targetAllocation !== null &&
      minTokenAAllocation !== null &&
      minTokenBAllocation !== null
    ) {
      ({
        targetAllocation,
        minTokenAAllocation,
        minTokenBAllocation,
      } = normalizeAllocations(
        targetAllocation,
        minTokenAAllocation,
        minTokenBAllocation,
      ));
    }

    let startBalance: number | null = null;
    if (status === AgentStatus.Active) {
      if (
        !body.model ||
        !tokenA ||
        !tokenB ||
        targetAllocation === null ||
        minTokenAAllocation === null ||
        minTokenBAllocation === null ||
        !body.risk ||
        !body.reviewInterval ||
        !body.agentInstructions
      )
        return reply.code(400).send(errorResponse('missing fields'));

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
        return reply.code(400).send(errorResponse('missing api keys'));
      try {
        startBalance = await fetchTotalBalanceUsd(userId);
      } catch {
        return reply
          .code(500)
          .send(errorResponse('failed to fetch balance'));
      }
      if (startBalance === null)
        return reply
          .code(500)
          .send(errorResponse('failed to fetch balance'));
    }

    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, start_balance, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.userId,
      body.model ?? null,
      status,
      createdAt,
      startBalance,
      body.name ?? null,
      tokenA,
      tokenB,
      targetAllocation,
      minTokenAAllocation,
      minTokenBAllocation,
      body.risk ?? null,
      body.reviewInterval ?? null,
      body.agentInstructions ?? null,
    );
    const row = getAgent(id)!;
    if (status === AgentStatus.Active) await reviewPortfolio(req.log, id);
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
    const existing = getAgent(id);
    if (!existing)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    const body = req.body as any;
    if (existing.user_id !== userId || body.userId !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));

    const tokenA = body.tokenA
      ? body.tokenA.toUpperCase()
      : existing.token_a;
    const tokenB = body.tokenB
      ? body.tokenB.toUpperCase()
      : existing.token_b;

    let targetAllocation =
      body.targetAllocation ?? existing.target_allocation;
    let minTokenAAllocation =
      body.minTokenAAllocation ?? existing.min_a_allocation;
    let minTokenBAllocation =
      body.minTokenBAllocation ?? existing.min_b_allocation;
    if (
      targetAllocation !== null &&
      minTokenAAllocation !== null &&
      minTokenBAllocation !== null
    ) {
      ({
        targetAllocation,
        minTokenAAllocation,
        minTokenBAllocation,
      } = normalizeAllocations(
        targetAllocation,
        minTokenAAllocation,
        minTokenBAllocation,
      ));
    }

    const status: AgentStatus = body.status ?? existing.status as AgentStatus;
    let startBalance = existing.start_balance;
    if (status === AgentStatus.Active && existing.status !== AgentStatus.Active) {
      if (
        !(body.model ?? existing.model) ||
        !tokenA ||
        !tokenB ||
        targetAllocation === null ||
        minTokenAAllocation === null ||
        minTokenBAllocation === null ||
        !(body.risk ?? existing.risk) ||
        !(body.reviewInterval ?? existing.review_interval) ||
        !(body.agentInstructions ?? existing.agent_instructions)
      )
        return reply.code(400).send(errorResponse('missing fields'));
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
        return reply.code(400).send(errorResponse('missing api keys'));
      try {
        startBalance = await fetchTotalBalanceUsd(userId);
      } catch {
        return reply
          .code(500)
          .send(errorResponse('failed to fetch balance'));
      }
      if (startBalance === null)
        return reply
          .code(500)
          .send(errorResponse('failed to fetch balance'));
    }

    if (body.model && body.model.length > MAX_MODEL_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('model', MAX_MODEL_LENGTH)));
    if (body.name && body.name.length > MAX_NAME_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('name', MAX_NAME_LENGTH)));
    if (body.risk && body.risk.length > MAX_RISK_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('risk', MAX_RISK_LENGTH)));
    if (body.reviewInterval && body.reviewInterval.length > MAX_REVIEW_INTERVAL_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('reviewInterval', MAX_REVIEW_INTERVAL_LENGTH)));
    if (body.agentInstructions && body.agentInstructions.length > MAX_INSTRUCTIONS_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('agentInstructions', MAX_INSTRUCTIONS_LENGTH)));

    db.prepare(
      `UPDATE agents SET user_id = ?, model = ?, status = ?, name = ?, token_a = ?, token_b = ?, target_allocation = ?, min_a_allocation = ?, min_b_allocation = ?, risk = ?, review_interval = ?, agent_instructions = ?, start_balance = ? WHERE id = ?`
    ).run(
      body.userId,
      body.model ?? existing.model,
      status,
      body.name ?? existing.name,
      tokenA,
      tokenB,
      targetAllocation,
      minTokenAAllocation,
      minTokenBAllocation,
      body.risk ?? existing.risk,
      body.reviewInterval ?? existing.review_interval,
      body.agentInstructions ?? existing.agent_instructions,
      startBalance,
      id,
    );
    const row = getAgent(id)!;
    if (status === AgentStatus.Active && existing.status !== AgentStatus.Active)
      await reviewPortfolio(req.log, id);
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
