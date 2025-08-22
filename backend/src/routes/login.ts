import type { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { authenticator } from 'otplib';
import { env } from '../util/env.js';
import { RATE_LIMITS } from '../rate-limit.js';
import { getUser, insertUser } from '../repos/users.js';

interface ValidationErr {
  code: number;
  body: unknown;
}

const client = new OAuth2Client();

async function verifyToken(token: string) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

export default async function loginRoutes(app: FastifyInstance) {
  app.post(
    '/login',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const body = z
        .object({ token: z.string(), otp: z.string().optional() })
        .parse(req.body);
      const payload = await verifyToken(body.token);
      if (!payload?.sub)
        return reply.code(400).send({ error: 'invalid token' });
      const id = payload.sub;
      const row = getUser(id);
      if (!row) {
        insertUser(id);
        return { id, email: payload.email, role: 'user' };
      }
      if (!row.is_enabled) {
        return reply.code(403).send({ error: 'user disabled' });
      }
      const err = validateOtp(row, body.otp);
      if (err) return reply.code(err.code).send(err.body);
      return { id, email: payload.email, role: row.role };
    }
  );
}

function validateOtp(
  row: { totp_secret?: string; is_totp_enabled?: number },
  otp: string | undefined,
): ValidationErr | null {
  if (row.is_totp_enabled && row.totp_secret) {
    if (!otp) return { code: 401, body: { error: 'otp required' } };
    const valid = authenticator.verify({ token: otp, secret: row.totp_secret });
    if (!valid) return { code: 401, body: { error: 'invalid otp' } };
  }
  return null;
}
