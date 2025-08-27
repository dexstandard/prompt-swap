import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../util/auth.js';
import { listUsers, setUserEnabled, getUser } from '../repos/users.js';
import { RATE_LIMITS } from '../rate-limit.js';
import { errorResponse } from '../util/errorMessages.js';
import { decrypt } from '../util/crypto.js';
import { env } from '../util/env.js';

export default async function usersRoutes(app: FastifyInstance) {
  app.get(
    '/users',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const adminId = await requireAdmin(req, reply);
      if (!adminId) return;
      const rows = await listUsers();
      return rows.map((u) => ({
        id: u.id,
        role: u.role,
        isEnabled: !!u.is_enabled,
        email: u.email_enc ? decrypt(u.email_enc, env.KEY_PASSWORD) : null,
        createdAt: u.created_at,
      }));
    },
  );

  app.post(
    '/users/:id/enable',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const adminId = await requireAdmin(req, reply);
      if (!adminId) return;
      const { id } = req.params as { id: string };
      const row = await getUser(id);
      if (!row) return reply.code(404).send(errorResponse('user not found'));
      await setUserEnabled(id, true);
      return { ok: true };
    },
  );

  app.post(
    '/users/:id/disable',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const adminId = await requireAdmin(req, reply);
      if (!adminId) return;
      const { id } = req.params as { id: string };
      const row = await getUser(id);
      if (!row) return reply.code(404).send(errorResponse('user not found'));
      await setUserEnabled(id, false);
      return { ok: true };
    },
  );
}
