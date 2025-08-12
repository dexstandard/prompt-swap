import type { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { db } from '../db/index.js';
import { env } from '../util/env.js';

const client = new OAuth2Client();

export default async function loginRoutes(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const body = z.object({ token: z.string() }).parse(req.body);
    const ticket = await client.verifyIdToken({
      idToken: body.token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return reply.code(400).send({ error: 'invalid token' });
    const id = payload.sub;
    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(id) as { id: string } | undefined;
    if (!row) {
      db.prepare('INSERT INTO users (id, is_auto_enabled) VALUES (?, 0)').run(id);
    }
    return { id, email: payload.email };
  });
}
