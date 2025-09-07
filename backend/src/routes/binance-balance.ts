import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fetchAccount, fetchTotalBalanceUsd } from '../services/binance.js';
import { requireUserIdMatch } from '../util/auth.js';
import { errorResponse, ERROR_MESSAGES } from '../util/errorMessages.js';
import { RATE_LIMITS } from '../rate-limit.js';
import { parseParams } from '../util/validation.js';

const idParams = z.object({ id: z.string().regex(/^\d+$/) });
const idTokenParams = z.object({
  id: z.string().regex(/^\d+$/),
  token: z.string(),
});

export default async function binanceBalanceRoutes(app: FastifyInstance) {
  app.get(
    '/users/:id/binance-balance',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
    let total;
    try {
      total = await fetchTotalBalanceUsd(id);
    } catch {
      return reply
        .code(500)
        .send(errorResponse('failed to fetch account'));
    }
    if (total === null)
      return reply.code(404).send(errorResponse(ERROR_MESSAGES.notFound));
    return { totalUsd: total };
    }
  );

  app.get(
    '/users/:id/binance-balance/:token',
    { config: { rateLimit: RATE_LIMITS.RELAXED } },
    async (req, reply) => {
      const params = parseParams(idTokenParams, req.params, reply);
      if (!params) return;
      const { id, token } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      let account;
      try {
        account = await fetchAccount(id);
      } catch {
        return reply
          .code(500)
          .send(errorResponse('failed to fetch account'));
      }
      if (!account)
        return reply.code(404).send(errorResponse(ERROR_MESSAGES.notFound));
      const sym = token.toUpperCase();
      const bal = account.balances.find((b) => b.asset === sym);
      if (!bal) return { asset: sym, free: 0, locked: 0 };
      return {
        asset: sym,
        free: Number(bal.free),
        locked: Number(bal.locked),
      };
    }
  );
}
