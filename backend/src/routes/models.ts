import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { requireUserId } from '../util/auth.js';
import { errorResponse, ERROR_MESSAGES } from '../util/errorMessages.js';
import { RATE_LIMITS } from '../rate-limit.js';

export default async function modelsRoutes(app: FastifyInstance) {
  app.get(
    '/users/:id/models',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const userId = requireUserId(req, reply);
      if (!userId) return;
    if (userId !== id)
      return reply
        .code(403)
        .send(errorResponse(ERROR_MESSAGES.forbidden));
    const row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get(id) as { ai_api_key_enc?: string } | undefined;
    if (!row?.ai_api_key_enc)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok)
        return reply
          .code(500)
          .send(errorResponse('failed to fetch models'));
      const json = await res.json();
      const models = (json.data as { id: string }[])
        .map((m) => m.id)
        .filter((id: string) => /^(gpt-5|o3|search)/.test(id));
      return { models };
      } catch {
        return reply
          .code(500)
          .send(errorResponse('failed to fetch models'));
      }
    }
  );
}
