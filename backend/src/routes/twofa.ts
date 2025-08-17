import type { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { db } from '../db/index.js';

export default async function twofaRoutes(app: FastifyInstance) {
  app.get('/2fa/status', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId) return reply.code(403).send({ error: 'forbidden' });
    const row = db
      .prepare('SELECT is_totp_enabled FROM users WHERE id = ?')
      .get(userId) as { is_totp_enabled?: number } | undefined;
    return { enabled: !!row?.is_totp_enabled };
  });

  app.get('/2fa/setup', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId) return reply.code(403).send({ error: 'forbidden' });
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userId, 'PromptSwap', secret);
    return { secret, otpauthUrl };
  });

  app.post('/2fa/enable', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId) return reply.code(403).send({ error: 'forbidden' });
    const body = req.body as { token: string; secret: string };
    const valid = authenticator.verify({ token: body.token, secret: body.secret });
    if (!valid) return reply.code(400).send({ error: 'invalid token' });
    db.prepare('UPDATE users SET totp_secret = ?, is_totp_enabled = 1 WHERE id = ?').run(
      body.secret,
      userId,
    );
    return { enabled: true };
  });

  app.post('/2fa/disable', async (req, reply) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId) return reply.code(403).send({ error: 'forbidden' });
    const body = req.body as { token: string };
    const row = db
      .prepare('SELECT totp_secret FROM users WHERE id = ?')
      .get(userId) as { totp_secret?: string } | undefined;
    if (!row?.totp_secret) return reply.code(400).send({ error: 'not enabled' });
    const valid = authenticator.verify({ token: body.token, secret: row.totp_secret });
    if (!valid) return reply.code(400).send({ error: 'invalid token' });
    db.prepare('UPDATE users SET totp_secret = NULL, is_totp_enabled = 0 WHERE id = ?').run(userId);
    return { enabled: false };
  });
}
