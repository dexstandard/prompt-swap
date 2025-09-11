import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fetchEarnFlexibleBalance } from '../services/binance.js';
import { requireUserIdMatch } from '../util/auth.js';
import { errorResponse, ERROR_MESSAGES } from '../util/errorMessages.js';
import { RATE_LIMITS } from '../rate-limit.js';
import { parseParams } from '../util/validation.js';

const idTokenParams = z.object({
  id: z.string().regex(/^\d+$/),
  token: z.string(),
});

export default async function binanceEarnBalanceRoutes(app: FastifyInstance) {
  app.get(
    '/users/:id/binance-earn-balance/:token',
    { config: { rateLimit: RATE_LIMITS.RELAXED } },
    async (req, reply) => {
      const params = parseParams(idTokenParams, req.params, reply);
      if (!params) return;
      const { id, token } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      let amount: number | null;
      try {
        amount = await fetchEarnFlexibleBalance(id, token);
      } catch {
        return reply
          .code(500)
          .send(errorResponse('failed to fetch earn balance'));
      }
      if (amount === null)
        return reply.code(404).send(errorResponse(ERROR_MESSAGES.notFound));
      return { asset: token.toUpperCase(), total: amount };
    }
  );
}
