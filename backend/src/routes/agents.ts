import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
import { getAgentReviewResults } from '../repos/agent-review-result.js';
import { errorResponse, ERROR_MESSAGES } from '../util/errorMessages.js';
import {
  reviewAgentPortfolio,
  removeAgentFromSchedule,
} from '../jobs/review-portfolio.js';
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
import * as binance from '../services/binance.js';
import {
  cancelOpenLimitOrdersByAgent,
  getLimitOrdersByReviewResult,
} from '../repos/limit-orders.js';
import { createRebalanceLimitOrder } from '../services/rebalance.js';
import { getRebalanceInfo } from '../repos/agent-review-result.js';


async function getAgentForRequest(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<{ userId: string; id: string; log: FastifyBaseLogger; agent: any } | undefined> {
  const userId = requireUserId(req, reply);
  if (!userId) return;
  const id = (req.params as any).id as string;
  const log = req.log.child({ userId, agentId: id });
  const agent = await getAgent(id);
  if (!agent || agent.status === AgentStatus.Retired) {
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
      const log = req.log.child({ userId });
      const { page = '1', pageSize = '10', status } = req.query as {
        page?: string;
        pageSize?: string;
        status?: AgentStatus;
      };
      const p = Math.max(parseInt(page, 10), 1);
      const ps = Math.max(parseInt(pageSize, 10), 1);
      const offset = (p - 1) * ps;
      const { rows, total } = await getAgentsPaginated(userId, status, ps, offset);
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
        const log = req.log.child({ userId });
        const res = await prepareAgentForUpsert(log, userId, body);
        if ('code' in res) return reply.code(res.code).send(res.body);
        const { body: validated, startBalance } = res;
        const status = validated.status;
        const row = await insertAgent({
          userId: validated.userId,
          model: validated.model,
          status,
          startBalance,
          name: validated.name,
          tokens: validated.tokens,
          risk: validated.risk,
          reviewInterval: validated.reviewInterval,
          agentInstructions: validated.agentInstructions,
          manualRebalance: validated.manualRebalance,
        });
        if (status === AgentStatus.Active)
          reviewAgentPortfolio(req.log, row.id).catch((err) =>
            log.error({ err, agentId: row.id }, 'initial review failed'),
          );
        log.info({ agentId: row.id }, 'created agent');
        return toApi(row);
      }
    );

  app.get(
    '/agents/:id/exec-log',
    { config: { rateLimit: RATE_LIMITS.RELAXED } },
    async (req, reply) => {
      const ctx = await getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, log } = ctx;
      const { page = '1', pageSize = '10', rebalanceOnly } = req.query as {
        page?: string;
        pageSize?: string;
        rebalanceOnly?: string;
      };
      const p = Math.max(parseInt(page, 10), 1);
      const ps = Math.max(parseInt(pageSize, 10), 1);
      const offset = (p - 1) * ps;
      const ro = rebalanceOnly === 'true';
      const { rows, total } = await getAgentReviewResults(id, ps, offset, ro);
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
    '/agents/:id/exec-log/:logId/orders',
    { config: { rateLimit: RATE_LIMITS.RELAXED } },
    async (req, reply) => {
      const ctx = await getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, log } = ctx;
      const { logId } = req.params as { id: string; logId: string };
      const rows = await getLimitOrdersByReviewResult(id, logId);
      log.info({ execLogId: logId }, 'fetched exec orders');
      return {
        orders: rows.map((r) => {
          const planned = JSON.parse(r.planned_json);
          return {
            side: planned.side,
            quantity: planned.quantity,
            price: planned.price,
            status: r.status,
          } as const;
        }),
      };
    },
  );

  app.post(
    '/agents/:id/exec-log/:logId/rebalance',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const ctx = await getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, userId, log, agent } = ctx;
      if (!agent.manual_rebalance) {
        log.error('agent not in manual mode');
        return reply
          .code(400)
          .send(errorResponse('manual rebalance disabled'));
      }
      const { logId } = req.params as { id: string; logId: string };
      const existing = await getLimitOrdersByReviewResult(id, logId);
      if (existing.length) {
        log.error({ execLogId: logId }, 'manual order exists');
        return reply
          .code(400)
          .send(errorResponse('order already exists for log'));
      }
      const result = await getRebalanceInfo(id, logId);
      if (!result || !result.rebalance || result.newAllocation === null) {
        log.error({ execLogId: logId }, 'no rebalance info');
        return reply.code(400).send(errorResponse('no rebalance info'));
      }
      const token1 = agent.tokens[0].token;
      const token2 = agent.tokens[1].token;
      const account = await binance.fetchAccount(userId);
      if (!account) {
        log.error('missing api keys');
        return reply.code(400).send(errorResponse('missing api keys'));
      }
      const bal1 = account.balances.find((b) => b.asset === token1);
      const bal2 = account.balances.find((b) => b.asset === token2);
      if (!bal1 || !bal2) {
        log.error('missing balances');
        return reply.code(400).send(errorResponse('failed to fetch balances'));
      }
      const [price1Data, price2Data] = await Promise.all([
        token1 === 'USDT'
          ? Promise.resolve({ currentPrice: 1 })
          : binance.fetchPairData(token1, 'USDT'),
        token2 === 'USDT'
          ? Promise.resolve({ currentPrice: 1 })
          : binance.fetchPairData(token2, 'USDT'),
      ]);
      const positions = [
        {
          sym: token1,
          value_usdt:
            (Number(bal1.free) + Number(bal1.locked)) * price1Data.currentPrice,
        },
        {
          sym: token2,
          value_usdt:
            (Number(bal2.free) + Number(bal2.locked)) * price2Data.currentPrice,
        },
      ];
      await createRebalanceLimitOrder({
        userId,
        tokens: [token1, token2],
        positions,
        newAllocation: result.newAllocation,
        reviewResultId: logId,
        log,
      });
      log.info({ execLogId: logId }, 'created manual order');
      return reply.code(201).send({ ok: true });
    },
  );

  app.get(
    '/agents/:id',
    { config: { rateLimit: RATE_LIMITS.RELAXED } },
    async (req, reply) => {
      const ctx = await getAgentForRequest(req, reply);
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
        const ctx = await getAgentForRequest(req, reply);
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
        await updateAgent({
          id,
          model: validated.model,
          status,
          name: validated.name,
          tokens: validated.tokens,
          risk: validated.risk,
          reviewInterval: validated.reviewInterval,
          agentInstructions: validated.agentInstructions,
          startBalance,
          manualRebalance: validated.manualRebalance,
        });
        const row = (await getAgent(id))!;
        if (status === AgentStatus.Active)
          await reviewAgentPortfolio(req.log, id);
        log.info('updated agent');
        return toApi(row);
      }
    );

  app.delete(
    '/agents/:id',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const ctx = await getAgentForRequest(req, reply);
      if (!ctx) return;
      const { userId, id, log, agent } = ctx;
      await repoDeleteAgent(id);
      removeAgentFromSchedule(id);
      const token1 = agent.tokens[0].token;
      const token2 = agent.tokens[1].token;
      try {
        await binance.cancelOpenOrders(userId, {
          symbol: `${token1}${token2}`,
        });
      } catch (err) {
        log.error({ err }, 'failed to cancel open orders');
      }
      await cancelOpenLimitOrdersByAgent(id);
      log.info('deleted agent');
      return { ok: true };
    }
  );

  app.post(
    '/agents/:id/start',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const ctx = await getAgentForRequest(req, reply);
      if (!ctx) return;
      const { userId, id, log, agent: existing } = ctx;
      if (!existing.model) {
        log.error('missing model');
        return reply.code(400).send(errorResponse('model required'));
      }
      const tokens = existing.tokens.map((t: { token: string }) => t.token);
      const conflict = await validateTokenConflicts(
        log,
        userId,
        tokens,
        id,
      );
      if (conflict) return reply.code(conflict.code).send(conflict.body);
      const keyErr = await ensureApiKeys(log, userId);
      if (keyErr) return reply.code(keyErr.code).send(keyErr.body);
      const bal = await getStartBalance(log, userId, tokens);
      if (typeof bal !== 'number') return reply.code(bal.code).send(bal.body);
      await repoStartAgent(id, bal);
      reviewAgentPortfolio(req.log, id).catch((err) =>
        log.error({ err }, 'initial review failed')
      );
      const row = (await getAgent(id))!;
      log.info('started agent');
      return toApi(row);
    }
  );

  app.post(
    '/agents/:id/stop',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const ctx = await getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, log } = ctx;
      await repoStopAgent(id);
      const row = (await getAgent(id))!;
      log.info('stopped agent');
      return toApi(row);
    }
  );

  app.post(
    '/agents/:id/review',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const ctx = await getAgentForRequest(req, reply);
      if (!ctx) return;
      const { id, log, agent } = ctx;
      if (agent.status !== AgentStatus.Active) {
        log.error('agent not active');
        return reply
          .code(400)
          .send(errorResponse('agent not active'));
      }
      try {
        await reviewAgentPortfolio(req.log, id);
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
