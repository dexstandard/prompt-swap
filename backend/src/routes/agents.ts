import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';
import {
  getAgent,
  getAgentsPaginated,
  toApi,
  findIdenticalDraftAgent,
  findActiveTokenConflicts,
  getUserApiKeys,
  insertAgent,
  getAgentExecLog,
  updateAgent,
  deleteAgent as repoDeleteAgent,
  startAgent as repoStartAgent,
  stopAgent as repoStopAgent,
} from '../repos/agents.js';
import {
  errorResponse,
  lengthMessage,
  ERROR_MESSAGES,
} from '../util/errorMessages.js';
import reviewPortfolio from '../jobs/review-portfolio.js';
import { requireUserId } from '../util/auth.js';
import { fetchTotalBalanceUsd } from '../services/binance.js';
import { calculatePnl } from '../services/pnl.js';
import { RATE_LIMITS } from '../rate-limit.js';
import { parseExecLog } from '../util/parse-exec-log.js';
import { validateAllocations } from '../util/allocations.js';

interface ValidationErr {
  code: number;
  body: unknown;
}

function validateTokenConflicts(
  log: Logger,
  userId: string,
  tokenA: string,
  tokenB: string,
  id?: string,
): ValidationErr | null {
  const dupRows = findActiveTokenConflicts(userId, tokenA, tokenB, id);
  if (!dupRows.length) return null;
  const conflicts: { token: string; id: string; name: string }[] = [];
  for (const row of dupRows) {
    if (row.token_a === tokenA || row.token_b === tokenA)
      conflicts.push({ token: tokenA, id: row.id, name: row.name });
    if (row.token_a === tokenB || row.token_b === tokenB)
      conflicts.push({ token: tokenB, id: row.id, name: row.name });
  }
  const parts = conflicts.map((c) => `${c.token} used by ${c.name} (${c.id})`);
  const msg = `token${parts.length > 1 ? 's' : ''} ${parts.join(', ')} already used`;
  log.error('token conflict');
  return { code: 400, body: errorResponse(msg) };
}

function validateAgentInput(
  log: Logger,
  userId: string,
  body: {
    userId: string;
    model: string;
    name: string;
    tokenA: string;
    tokenB: string;
    minTokenAAllocation: number;
    minTokenBAllocation: number;
    risk: string;
    reviewInterval: string;
    agentInstructions: string;
    status: AgentStatus;
  },
  id?: string,
): ValidationErr | null {
  if (body.userId !== userId) {
    log.error('user mismatch');
    return { code: 403, body: errorResponse(ERROR_MESSAGES.forbidden) };
  }
  if (body.model.length > 50) {
    log.error('model too long');
    return { code: 400, body: errorResponse(lengthMessage('model', 50)) };
  }
  if (body.status === AgentStatus.Draft) {
    const dupDraft = findIdenticalDraftAgent(
      {
        userId: body.userId,
        model: body.model,
        name: body.name,
        tokenA: body.tokenA,
        tokenB: body.tokenB,
        minTokenAAllocation: body.minTokenAAllocation,
        minTokenBAllocation: body.minTokenBAllocation,
        risk: body.risk,
        reviewInterval: body.reviewInterval,
        agentInstructions: body.agentInstructions,
      },
      id,
    );
    if (dupDraft) {
      log.error({ agentId: dupDraft.id }, 'identical draft exists');
      return {
        code: 400,
        body: errorResponse(
          `identical draft already exists: ${dupDraft.name} (${dupDraft.id})`,
        ),
      };
    }
  } else {
    const conflict = validateTokenConflicts(
      log,
      body.userId,
      body.tokenA,
      body.tokenB,
      id,
    );
    if (conflict) return conflict;
  }
  return null;
}

function ensureApiKeys(log: Logger, userId: string): ValidationErr | null {
  const userRow = getUserApiKeys(userId);
  if (
    !userRow?.ai_api_key_enc ||
    !userRow.binance_api_key_enc ||
    !userRow.binance_api_secret_enc
  ) {
    log.error('missing api keys');
    return { code: 400, body: errorResponse('missing api keys') };
  }
  return null;
}

async function getStartBalance(
  log: Logger,
  userId: string,
): Promise<number | ValidationErr> {
  try {
    const startBalance = await fetchTotalBalanceUsd(userId);
    if (startBalance === null) {
      log.error('failed to fetch balance');
      return { code: 500, body: errorResponse('failed to fetch balance') };
    }
    return startBalance;
  } catch {
    log.error('failed to fetch balance');
    return { code: 500, body: errorResponse('failed to fetch balance') };
  }
}

function getAgentForRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): { userId: string; id: string; log: Logger; agent: any } | undefined {
  const userId = requireUserId(req, reply);
  if (!userId) return;
  const id = (req.params as any).id;
  const log = req.log.child({ userId, agentId: id }) as unknown as Logger;
  const agent = getAgent(id);
  if (!agent) {
    log.error('agent not found');
    reply.code(404).send(errorResponse(ERROR_MESSAGES.notFound));
    return;
  }
  if (agent.user_id !== userId) {
    log.error('forbidden');
    reply.code(403).send(errorResponse(ERROR_MESSAGES.forbidden));
    return;
  }
  return { userId, id, log, agent };
}

export enum AgentStatus {
  Active = 'active',
  Inactive = 'inactive',
  Draft = 'draft',
}

export default async function agentRoutes(app: FastifyInstance) {
  app.get(
    '/agents/paginated',
    { config: { rateLimit: RATE_LIMITS.RELAXED } },
    async (req, reply) => {
      const userId = requireUserId(req, reply);
      if (!userId) return;
      const log = req.log.child({ userId }) as unknown as Logger;
      const { page = '1', pageSize = '10', status } = req.query as {
        page?: string;
        pageSize?: string;
        status?: AgentStatus;
      };
      const p = Math.max(parseInt(page, 10), 1);
      const ps = Math.max(parseInt(pageSize, 10), 1);
      const offset = (p - 1) * ps;
      const { rows, total } = getAgentsPaginated(userId, status, ps, offset);
      log.info('listed agents');
      return {
        items: rows.map(toApi),
        total,
        page: p,
        pageSize: ps,
      };
    }
  );

  app.post(
    '/agents',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const body = req.body as {
        userId: string;
        model: string;
        name: string;
        tokenA: string;
        tokenB: string;
        minTokenAAllocation: number;
        minTokenBAllocation: number;
        risk: string;
        reviewInterval: string;
        agentInstructions: string;
        status: AgentStatus;
      };
      const userId = requireUserId(req, reply);
      if (!userId) return;
      const log = req.log.child({ userId }) as unknown as Logger;
      let norm;
      try {
        norm = validateAllocations(
          body.minTokenAAllocation,
          body.minTokenBAllocation,
        );
      } catch {
        log.error('invalid allocations');
        return reply
          .code(400)
          .send(errorResponse('invalid minimum allocations'));
      }
      body.minTokenAAllocation = norm.minTokenAAllocation;
      body.minTokenBAllocation = norm.minTokenBAllocation;
      const err = validateAgentInput(log, userId, body);
      if (err) return reply.code(err.code).send(err.body);
      let startBalance: number | null = null;
      if (body.status === AgentStatus.Active) {
        const keyErr = ensureApiKeys(log, body.userId);
        if (keyErr) return reply.code(keyErr.code).send(keyErr.body);
        const bal = await getStartBalance(log, userId);
        if (typeof bal === 'number') startBalance = bal;
        else return reply.code(bal.code).send(bal.body);
      }
      const id = randomUUID();
      const status = body.status;
      const createdAt = Date.now();
      insertAgent({
        id,
        userId: body.userId,
        model: body.model,
        status,
        createdAt,
        startBalance,
        name: body.name,
        tokenA: body.tokenA,
        tokenB: body.tokenB,
        minTokenAAllocation: body.minTokenAAllocation,
        minTokenBAllocation: body.minTokenBAllocation,
        risk: body.risk,
        reviewInterval: body.reviewInterval,
        agentInstructions: body.agentInstructions,
      });
      const row = getAgent(id)!;
      if (body.status === AgentStatus.Active)
        reviewPortfolio(req.log as unknown as Logger, id).catch((err) =>
          log.error({ err, agentId: id }, 'initial review failed'),
        );
      log.info({ agentId: id }, 'created agent');
      return toApi(row);
    }
  );

  app.get(
    '/agents/:id/exec-log',
    { config: { rateLimit: RATE_LIMITS.RELAXED } },
    async (req, reply) => {
      const ctx = getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, log } = ctx;
      const { page = '1', pageSize = '10' } = req.query as {
        page?: string;
        pageSize?: string;
      };
      const p = Math.max(parseInt(page, 10), 1);
      const ps = Math.max(parseInt(pageSize, 10), 1);
      const offset = (p - 1) * ps;
      const { rows, total } = getAgentExecLog(id, ps, offset);
      log.info('fetched exec log');
      return {
        items: rows.map((r) => {
          const parsed = parseExecLog(r.log);
          return {
            id: r.id,
            log: parsed.text,
            response: parsed.response,
            error: parsed.error,
            createdAt: r.created_at,
          };
        }),
        total,
        page: p,
        pageSize: ps,
      };
    }
  );

  app.get(
    '/agents/:id',
    { config: { rateLimit: RATE_LIMITS.RELAXED } },
    async (req, reply) => {
      const ctx = getAgentForRequest(req, reply);
      if (!ctx) return;
      const { log, agent: row } = ctx;
      log.info('fetched agent');
      return toApi(row);
    }
  );

  app.get(
    '/agents/:id/pnl',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const ctx = getAgentForRequest(req, reply);
      if (!ctx) return;
      const { userId, id, log } = ctx;
      const perf = await calculatePnl(id, userId);
      if (!perf) {
        log.error('pnl not found');
        return reply
          .code(404)
          .send(errorResponse(ERROR_MESSAGES.notFound));
      }
      log.info('fetched pnl');
      return perf;
    }
  );

  app.put(
    '/agents/:id',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const ctx = getAgentForRequest(req, reply);
      if (!ctx) return;
      const { userId, id, log } = ctx;
      const body = req.body as {
        userId: string;
        model: string;
        status: AgentStatus;
        name: string;
        tokenA: string;
        tokenB: string;
        minTokenAAllocation: number;
        minTokenBAllocation: number;
        risk: string;
        reviewInterval: string;
        agentInstructions: string;
      };
      if (body.userId !== userId) {
        log.error('forbidden');
        return reply
          .code(403)
          .send(errorResponse(ERROR_MESSAGES.forbidden));
      }
      let norm;
      try {
        norm = validateAllocations(
          body.minTokenAAllocation,
          body.minTokenBAllocation,
        );
      } catch {
        log.error('invalid allocations');
        return reply
          .code(400)
          .send(errorResponse('invalid minimum allocations'));
      }
      body.minTokenAAllocation = norm.minTokenAAllocation;
      body.minTokenBAllocation = norm.minTokenBAllocation;
      const err = validateAgentInput(log, userId, body, id);
      if (err) return reply.code(err.code).send(err.body);
      let startBalance: number | null = null;
      if (body.status === AgentStatus.Active) {
        const keyErr = ensureApiKeys(log, userId);
        if (keyErr) return reply.code(keyErr.code).send(keyErr.body);
        const bal = await getStartBalance(log, userId);
        if (typeof bal === 'number') startBalance = bal;
        else return reply.code(bal.code).send(bal.body);
      }
      const status = body.status;
      updateAgent({
        id,
        userId: body.userId,
        model: body.model,
        status,
        name: body.name,
        tokenA: body.tokenA,
        tokenB: body.tokenB,
        minTokenAAllocation: body.minTokenAAllocation,
        minTokenBAllocation: body.minTokenBAllocation,
        risk: body.risk,
        reviewInterval: body.reviewInterval,
        agentInstructions: body.agentInstructions,
        startBalance,
      });
      const row = getAgent(id)!;
      if (status === AgentStatus.Active)
        await reviewPortfolio(req.log as unknown as Logger, id);
      log.info('updated agent');
      return toApi(row);
    }
  );

  app.delete(
    '/agents/:id',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const ctx = getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, log } = ctx;
      repoDeleteAgent(id);
      log.info('deleted agent');
      return { ok: true };
    }
  );

  app.post(
    '/agents/:id/start',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const ctx = getAgentForRequest(req, reply);
      if (!ctx) return;
      const { userId, id, log, agent: existing } = ctx;
      const conflict = validateTokenConflicts(
        log,
        userId,
        existing.token_a,
        existing.token_b,
        id,
      );
      if (conflict) return reply.code(conflict.code).send(conflict.body);
      const keyErr = ensureApiKeys(log, userId);
      if (keyErr) return reply.code(keyErr.code).send(keyErr.body);
      const bal = await getStartBalance(log, userId);
      if (typeof bal !== 'number') return reply.code(bal.code).send(bal.body);
      repoStartAgent(id, bal);
      reviewPortfolio(req.log as unknown as Logger, id).catch((err) =>
        log.error({ err }, 'initial review failed')
      );
      const row = getAgent(id)!;
      log.info('started agent');
      return toApi(row);
    }
  );

  app.post(
    '/agents/:id/stop',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const ctx = getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, log } = ctx;
      repoStopAgent(id);
      const row = getAgent(id)!;
      log.info('stopped agent');
      return toApi(row);
    }
  );
}
