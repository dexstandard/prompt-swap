import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { normalizeAllocations } from '../util/allocations.js';
import {
  errorResponse,
  lengthMessage,
  ERROR_MESSAGES,
} from '../util/errorMessages.js';
import { requireUserId } from '../util/auth.js';

const MAX_NAME_LENGTH = 50;
const MAX_INSTRUCTIONS_LENGTH = 2000;
const MAX_TOKEN_LENGTH = 10;
const MAX_RISK_LENGTH = 20;
const MAX_REVIEW_INTERVAL_LENGTH = 20;

interface AgentTemplateRow {
  id: string;
  user_id: string;
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

function toApi(row: AgentTemplateRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    tokenA: row.token_a.toUpperCase(),
    tokenB: row.token_b.toUpperCase(),
    targetAllocation: row.target_allocation,
    minTokenAAllocation: row.min_a_allocation,
    minTokenBAllocation: row.min_b_allocation,
    risk: row.risk,
    reviewInterval: row.review_interval,
    agentInstructions: row.agent_instructions,
  };
}

export default async function agentTemplateRoutes(app: FastifyInstance) {
  app.get('/agent-templates', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const rows = db
      .prepare<[string], AgentTemplateRow>(
        'SELECT * FROM agent_templates WHERE user_id = ? ORDER BY rowid DESC'
      )
      .all(userId);
    return rows.map(toApi);
  });

  app.get('/agent-templates/paginated', async (req, reply) => {
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
      .prepare('SELECT COUNT(*) as count FROM agent_templates WHERE user_id = ?')
      .get(userId) as { count: number };
    const rows = db
      .prepare(
        'SELECT * FROM agent_templates WHERE user_id = ? ORDER BY rowid DESC LIMIT ? OFFSET ?'
      )
      .all(userId, ps, offset) as AgentTemplateRow[];
    return {
      items: rows.map(toApi),
      total: totalRow.count,
      page: p,
      pageSize: ps,
    };
  });

  app.post('/agent-templates', async (req, reply) => {
    const body = req.body as {
      userId: string;
      name: string;
      tokenA: string;
      tokenB: string;
      targetAllocation: number;
      minTokenAAllocation: number;
      minTokenBAllocation: number;
      risk: string;
      reviewInterval: string;
      agentInstructions: string;
    };
    const userId = requireUserId(req, reply);
    if (!userId) return;
    if (body.userId !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    if (body.name.length > MAX_NAME_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('name', MAX_NAME_LENGTH)));
    if (body.tokenA.length > MAX_TOKEN_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('tokenA', MAX_TOKEN_LENGTH)));
    if (body.tokenB.length > MAX_TOKEN_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('tokenB', MAX_TOKEN_LENGTH)));
    if (body.risk.length > MAX_RISK_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('risk', MAX_RISK_LENGTH)));
    if (body.reviewInterval.length > MAX_REVIEW_INTERVAL_LENGTH)
      return reply
        .code(400)
        .send(
          errorResponse(
            lengthMessage('reviewInterval', MAX_REVIEW_INTERVAL_LENGTH)
          )
        );
    if (body.agentInstructions.length > MAX_INSTRUCTIONS_LENGTH)
      return reply
        .code(400)
        .send(
          errorResponse(
            lengthMessage('agentInstructions', MAX_INSTRUCTIONS_LENGTH)
          )
        );
    const id = randomUUID();
    const tokenA = body.tokenA.toUpperCase();
    const tokenB = body.tokenB.toUpperCase();
    const { targetAllocation, minTokenAAllocation, minTokenBAllocation } = normalizeAllocations(
      body.targetAllocation,
      body.minTokenAAllocation,
      body.minTokenBAllocation
    );
    const duplicate = db
      .prepare(
        `SELECT id FROM agent_templates WHERE user_id = ? AND token_a = ? AND token_b = ? AND target_allocation = ? AND min_a_allocation = ? AND min_b_allocation = ? AND risk = ? AND review_interval = ? AND agent_instructions = ?`
      )
      .get(
        body.userId,
        tokenA,
        tokenB,
        targetAllocation,
        minTokenAAllocation,
        minTokenBAllocation,
        body.risk,
        body.reviewInterval,
        body.agentInstructions
      ) as { id: string } | undefined;
    if (duplicate)
      return reply
        .code(400)
        .send({ ...errorResponse(ERROR_MESSAGES.templateExists), id: duplicate.id });
    db.prepare(
      `INSERT INTO agent_templates (id, user_id, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.userId,
      body.name,
      tokenA,
      tokenB,
      targetAllocation,
      minTokenAAllocation,
      minTokenBAllocation,
      body.risk,
      body.reviewInterval,
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

  app.get('/agent-templates/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT * FROM agent_templates WHERE id = ?')
      .get(id) as AgentTemplateRow | undefined;
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

  app.patch('/agent-templates/:id/instructions', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const body = req.body as { userId: string; agentInstructions: string };
    const existing = db
      .prepare('SELECT user_id FROM agent_templates WHERE id = ?')
      .get(id) as { user_id: string } | undefined;
    if (!existing)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    if (existing.user_id !== userId || body.userId !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    if (body.agentInstructions.length > MAX_INSTRUCTIONS_LENGTH)
      return reply
        .code(400)
        .send(
          errorResponse(
            lengthMessage('agentInstructions', MAX_INSTRUCTIONS_LENGTH)
          )
        );
    db.prepare('UPDATE agent_templates SET agent_instructions = ? WHERE id = ?')
      .run(body.agentInstructions, id);
    const row = db
      .prepare('SELECT * FROM agent_templates WHERE id = ?')
      .get(id) as AgentTemplateRow;
    return toApi(row);
  });

  app.patch('/agent-templates/:id/name', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const body = req.body as { userId: string; name: string };
    const existing = db
      .prepare('SELECT user_id FROM agent_templates WHERE id = ?')
      .get(id) as { user_id: string } | undefined;
    if (!existing)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    if (existing.user_id !== userId || body.userId !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    if (body.name.length > MAX_NAME_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('name', MAX_NAME_LENGTH)));
    db.prepare('UPDATE agent_templates SET name = ? WHERE id = ?').run(
      body.name,
      id
    );
    const row = db
      .prepare('SELECT * FROM agent_templates WHERE id = ?')
      .get(id) as AgentTemplateRow;
    return toApi(row);
  });

  app.put('/agent-templates/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const body = req.body as {
      userId: string;
      name: string;
      tokenA: string;
      tokenB: string;
      targetAllocation: number;
      minTokenAAllocation: number;
      minTokenBAllocation: number;
      risk: string;
      reviewInterval: string;
      agentInstructions: string;
    };
    const existing = db
      .prepare('SELECT * FROM agent_templates WHERE id = ?')
      .get(id) as AgentTemplateRow | undefined;
    if (!existing)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    if (existing.user_id !== userId || body.userId !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    const tokenA = body.tokenA.toUpperCase();
    const tokenB = body.tokenB.toUpperCase();
    if (body.name.length > MAX_NAME_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('name', MAX_NAME_LENGTH)));
    if (tokenA.length > MAX_TOKEN_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('tokenA', MAX_TOKEN_LENGTH)));
    if (tokenB.length > MAX_TOKEN_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('tokenB', MAX_TOKEN_LENGTH)));
    if (body.risk.length > MAX_RISK_LENGTH)
      return reply
        .code(400)
        .send(errorResponse(lengthMessage('risk', MAX_RISK_LENGTH)));
    if (body.reviewInterval.length > MAX_REVIEW_INTERVAL_LENGTH)
      return reply
        .code(400)
        .send(
          errorResponse(
            lengthMessage('reviewInterval', MAX_REVIEW_INTERVAL_LENGTH)
          )
        );
    if (body.agentInstructions.length > MAX_INSTRUCTIONS_LENGTH)
      return reply
        .code(400)
        .send(
          errorResponse(
            lengthMessage('agentInstructions', MAX_INSTRUCTIONS_LENGTH)
          )
        );
    const { targetAllocation, minTokenAAllocation, minTokenBAllocation } = normalizeAllocations(
      body.targetAllocation,
      body.minTokenAAllocation,
      body.minTokenBAllocation
    );
    const duplicate = db
      .prepare(
        `SELECT id FROM agent_templates WHERE user_id = ? AND token_a = ? AND token_b = ? AND target_allocation = ? AND min_a_allocation = ? AND min_b_allocation = ? AND risk = ? AND review_interval = ? AND agent_instructions = ? AND id <> ?`
      )
      .get(
        body.userId,
        tokenA,
        tokenB,
        targetAllocation,
        minTokenAAllocation,
        minTokenBAllocation,
        body.risk,
        body.reviewInterval,
        body.agentInstructions,
        id
      ) as { id: string } | undefined;
    if (duplicate)
      return reply
        .code(400)
        .send({ ...errorResponse(ERROR_MESSAGES.templateExists), id: duplicate.id });
    db.prepare(
      `UPDATE agent_templates SET user_id = ?, name = ?, token_a = ?, token_b = ?, target_allocation = ?, min_a_allocation = ?, min_b_allocation = ?, risk = ?, review_interval = ?, agent_instructions = ? WHERE id = ?`
    ).run(
      body.userId,
      body.name,
      tokenA,
      tokenB,
      targetAllocation,
      minTokenAAllocation,
      minTokenBAllocation,
      body.risk,
      body.reviewInterval,
      body.agentInstructions,
      id
    );
    const row = db
      .prepare('SELECT * FROM agent_templates WHERE id = ?')
      .get(id) as AgentTemplateRow;
    return toApi(row);
  });

  app.delete('/agent-templates/:id', async (req, reply) => {
    const userId = requireUserId(req, reply);
    if (!userId) return;
    const id = (req.params as any).id;
    const existing = db
      .prepare('SELECT user_id FROM agent_templates WHERE id = ?')
      .get(id) as { user_id: string } | undefined;
    if (!existing)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    if (existing.user_id !== userId)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    db.prepare('DELETE FROM agent_templates WHERE id = ?').run(id);
    return { ok: true };
  });
}
