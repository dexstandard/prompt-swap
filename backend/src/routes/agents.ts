import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';
import {
  getAgent,
  getAgentsPaginated,
  toApi,
  insertAgent,
  updateAgent,
  deleteAgent as repoDeleteAgent,
  startAgent as repoStartAgent,
  stopAgent as repoStopAgent,
} from '../repos/agents.js';
import { getAgentExecResults } from '../repos/agent-exec-result.js';
import { errorResponse, ERROR_MESSAGES } from '../util/errorMessages.js';
import reviewPortfolio from '../jobs/review-portfolio.js';
import { requireUserId } from '../util/auth.js';
import { RATE_LIMITS } from '../rate-limit.js';
import {
  AgentStatus,
  type AgentInput,
  prepareAgentForUpsert,
  validateTokenConflicts,
  ensureApiKeys,
  getStartBalance,
} from '../util/agents.js';


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
        const body = req.body as AgentInput;
        const userId = requireUserId(req, reply);
        if (!userId) return;
        const log = req.log.child({ userId }) as unknown as Logger;
        const res = await prepareAgentForUpsert(log, userId, body);
        if ('code' in res) return reply.code(res.code).send(res.body);
        const { body: validated, startBalance } = res;
        const id = randomUUID();
        const status = validated.status;
        const createdAt = Date.now();
        insertAgent({
          id,
          userId: validated.userId,
          model: validated.model,
          status,
          createdAt,
          startBalance,
          name: validated.name,
          tokenA: validated.tokenA,
          tokenB: validated.tokenB,
          minTokenAAllocation: validated.minTokenAAllocation,
          minTokenBAllocation: validated.minTokenBAllocation,
          risk: validated.risk,
          reviewInterval: validated.reviewInterval,
          agentInstructions: validated.agentInstructions,
        });
        const row = getAgent(id)!;
        if (status === AgentStatus.Active)
          reviewPortfolio(req.log, id).catch((err) =>
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
      const { rows, total } = getAgentExecResults(id, ps, offset);
      log.info('fetched exec log');
      return {
        items: rows.map((r) => {
          const resp =
            r.rebalance === null
              ? undefined
              : {
                  rebalance: !!r.rebalance,
                  ...(r.new_allocation !== null
                    ? { newAllocation: r.new_allocation }
                    : {}),
                  shortReport: r.short_report ?? '',
                };
          return {
            id: r.id,
            log: r.log,
            ...(resp ? { response: resp } : {}),
            ...(r.error ? { error: JSON.parse(r.error) } : {}),
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

    app.put(
      '/agents/:id',
      { config: { rateLimit: RATE_LIMITS.TIGHT } },
      async (req, reply) => {
        const ctx = getAgentForRequest(req, reply);
        if (!ctx) return;
        const { userId, id, log } = ctx;
        const body = req.body as AgentInput;
        if (body.userId !== userId) {
          log.error('forbidden');
          return reply
            .code(403)
            .send(errorResponse(ERROR_MESSAGES.forbidden));
        }
        const res = await prepareAgentForUpsert(log, userId, body, id);
        if ('code' in res) return reply.code(res.code).send(res.body);
        const { body: validated, startBalance } = res;
        const status = validated.status;
        updateAgent({
          id,
          userId: validated.userId,
          model: validated.model,
          status,
          name: validated.name,
          tokenA: validated.tokenA,
          tokenB: validated.tokenB,
          minTokenAAllocation: validated.minTokenAAllocation,
          minTokenBAllocation: validated.minTokenBAllocation,
          risk: validated.risk,
          reviewInterval: validated.reviewInterval,
          agentInstructions: validated.agentInstructions,
          startBalance,
        });
        const row = getAgent(id)!;
        if (status === AgentStatus.Active)
          await reviewPortfolio(req.log, id);
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
      const bal = await getStartBalance(
        log,
        userId,
        existing.token_a,
        existing.token_b,
      );
      if (typeof bal !== 'number') return reply.code(bal.code).send(bal.body);
      repoStartAgent(id, bal);
      reviewPortfolio(req.log, id).catch((err) =>
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

  app.post(
    '/agents/:id/review',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const ctx = getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, log, agent } = ctx;
      if (agent.status !== AgentStatus.Active) {
        log.error('agent not active');
        return reply
          .code(400)
          .send(errorResponse('agent not active'));
      }
      try {
        await reviewPortfolio(req.log, id);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'manual review failed';
        log.error({ err: msg }, 'manual review failed');
        return reply.code(400).send(errorResponse(msg));
      }
      log.info('manual review triggered');
      return { ok: true };
    }
  );
}
