import type { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { authenticator } from 'otplib';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { RATE_LIMITS } from '../rate-limit.js';

const client = new OAuth2Client();

export default async function loginRoutes(app: FastifyInstance) {
  app.post(
    '/login',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const body = z
        .object({ token: z.string(), otp: z.string().optional() })
        .parse(req.body);
    const ticket = await client.verifyIdToken({
      idToken: body.token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return reply.code(400).send({ error: 'invalid token' });
    const id = payload.sub;
    const row = db
      .prepare('SELECT totp_secret, is_totp_enabled FROM users WHERE id = ?')
      .get(id) as { totp_secret?: string; is_totp_enabled?: number } | undefined;
    if (!row) {
      db.prepare('INSERT INTO users (id, is_auto_enabled) VALUES (?, 0)').run(id);
    } else if (row.is_totp_enabled && row.totp_secret) {
      if (!body.otp)
        return reply.code(401).send({ error: 'otp required' });
      const valid = authenticator.verify({
        token: body.otp,
        secret: row.totp_secret,
      });
      if (!valid) return reply.code(401).send({ error: 'invalid otp' });
    }
    return { id, email: payload.email };
  }
  );
}
