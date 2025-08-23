import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { requireUserId } from '../util/auth.js';
import { errorResponse } from '../util/errorMessages.js';
import { RATE_LIMITS } from '../rate-limit.js';
import {
  clearUserTotp,
  getUserTotpSecret,
  getUserTotpStatus,
  setUserTotpSecret,
} from '../repos/users.js';

export default async function twofaRoutes(app: FastifyInstance) {
  app.get(
    '/2fa/status',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const userId = requireUserId(req, reply);
      if (!userId) return;
      return { enabled: getUserTotpStatus(userId) };
    }
  );

  app.get(
    '/2fa/setup',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const userId = requireUserId(req, reply);
      if (!userId) return;
      const secret = authenticator.generateSecret();
      const otpauthUrl = authenticator.keyuri(userId, 'PromptSwap', secret);
      return { secret, otpauthUrl };
    }
  );

  app.post(
    '/2fa/enable',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const userId = requireUserId(req, reply);
      if (!userId) return;
      const body = req.body as { token: string; secret: string };
      const valid = authenticator.verify({ token: body.token, secret: body.secret });
      if (!valid)
        return reply.code(400).send(errorResponse('invalid token'));
      setUserTotpSecret(userId, body.secret);
      return { enabled: true };
    }
  );

  app.post(
    '/2fa/disable',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const userId = requireUserId(req, reply);
      if (!userId) return;
      const body = req.body as { token: string };
      const secret = getUserTotpSecret(userId);
      if (!secret)
        return reply.code(400).send(errorResponse('not enabled'));
      const valid = authenticator.verify({ token: body.token, secret });
      if (!valid) return reply.code(400).send(errorResponse('invalid token'));
      clearUserTotp(userId);
      return { enabled: false };
    }
  );
}
