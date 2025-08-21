import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { db } from '../db/index.js';
import { requireUserId } from '../util/auth.js';
import { errorResponse } from '../util/errorMessages.js';
import { RATE_LIMITS } from '../rate-limit.js';

export default async function twofaRoutes(app: FastifyInstance) {
  app.get(
    '/2fa/status',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const userId = requireUserId(req, reply);
      if (!userId) return;
      const row = db
        .prepare('SELECT is_totp_enabled FROM users WHERE id = ?')
        .get(userId) as { is_totp_enabled?: number } | undefined;
      return { enabled: !!row?.is_totp_enabled };
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
      db.prepare('UPDATE users SET totp_secret = ?, is_totp_enabled = 1 WHERE id = ?').run(
        body.secret,
        userId,
      );
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
      const row = db
        .prepare('SELECT totp_secret FROM users WHERE id = ?')
        .get(userId) as { totp_secret?: string } | undefined;
      if (!row?.totp_secret)
        return reply.code(400).send(errorResponse('not enabled'));
      const valid = authenticator.verify({ token: body.token, secret: row.totp_secret });
      if (!valid) return reply.code(400).send(errorResponse('invalid token'));
      db.prepare('UPDATE users SET totp_secret = NULL, is_totp_enabled = 0 WHERE id = ?').run(
        userId
      );
      return { enabled: false };
    }
  );
}
