import type { FastifyInstance } from 'fastify';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { requireUserIdMatch } from '../util/auth.js';
import { errorResponse, ERROR_MESSAGES } from '../util/errorMessages.js';
import { RATE_LIMITS } from '../rate-limit.js';
import { getAiKeyRow } from '../repos/api-keys.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;
const modelsCache = new Map<string, { models: string[]; expires: number }>();

function getCachedModels(key: string) {
  const entry = modelsCache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    modelsCache.delete(key);
    return null;
  }
  return entry.models;
}

function setCachedModels(key: string, models: string[]) {
  modelsCache.set(key, { models, expires: Date.now() + SIX_HOURS });
}

export default async function modelsRoutes(app: FastifyInstance) {
  app.get(
    '/users/:id/models',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const id = (req.params as any).id;
      if (!requireUserIdMatch(req, reply, id)) return;
    const row = getAiKeyRow(id);
    if (!row?.ai_api_key_enc)
      return reply
        .code(404)
        .send(errorResponse(ERROR_MESSAGES.notFound));
    const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);
    const cached = getCachedModels(key);
    if (cached) return { models: cached };
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
        .filter(
          (id: string) =>
            id.startsWith('gpt-5') || id.startsWith('o3') || id.includes('search'),
        );
      setCachedModels(key, models);
      return { models };
      } catch {
        return reply
          .code(500)
          .send(errorResponse('failed to fetch models'));
      }
    }
  );
}
