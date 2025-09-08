import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RATE_LIMITS } from '../rate-limit.js';
import {
  getAiKeyRow,
  setAiKey,
  clearAiKey,
  getBinanceKeyRow,
  setBinanceKey,
  clearBinanceKey,
  shareAiKey,
  revokeAiKeyShare,
  hasAiKeyShare,
} from '../repos/api-keys.js';
import {
  getActiveAgentsByUser,
  deactivateAgentsByUser,
  draftAgentsByUser,
} from '../repos/agents.js';
import { removeAgentFromSchedule } from '../jobs/review-portfolio.js';
import { cancelOpenOrders } from '../services/binance.js';
import { requireUserIdMatch, requireAdmin } from '../util/auth.js';
import {
  ApiKeyType,
  verifyApiKey,
  encryptKey,
  ensureUser,
  ensureKeyAbsent,
  ensureKeyPresent,
  decryptKey,
} from '../util/api-keys.js';
import { errorResponse, ERROR_MESSAGES } from '../util/errorMessages.js';
import { findUserByEmail } from '../repos/users.js';
import { parseParams } from '../util/validation.js';

const idParams = z.object({ id: z.string().regex(/^\d+$/) });

export default async function apiKeyRoutes(app: FastifyInstance) {
  app.post(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      const { key } = req.body as { key: string };
      const row = await getAiKeyRow(id);
      let err = ensureUser(row);
      if (err) return reply.code(err.code).send(err.body);
      if (row!.is_shared)
        return reply
          .code(403)
          .send(errorResponse(ERROR_MESSAGES.forbidden));
      err = ensureKeyAbsent(row, ['ai_api_key_enc']);
      if (err) return reply.code(err.code).send(err.body);
      if (!(await verifyApiKey(ApiKeyType.Ai, key)))
        return reply.code(400).send(errorResponse('verification failed'));
      const enc = encryptKey(key);
      await setAiKey(id, enc);
      return { key: '<REDACTED>' };
    },
  );

  app.get(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      const row = await getAiKeyRow(id);
      if (!row?.id)
        return reply
          .code(404)
          .send(errorResponse(ERROR_MESSAGES.notFound));
      return { key: '<REDACTED>', ...(row.is_shared ? { shared: true } : {}) };
    },
  );

  app.put(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      const { key } = req.body as { key: string };
      const row = await getAiKeyRow(id);
      if (row?.is_shared)
        return reply
          .code(403)
          .send(errorResponse(ERROR_MESSAGES.forbidden));
      if (!row?.ai_api_key_enc)
        return reply
          .code(404)
          .send(errorResponse(ERROR_MESSAGES.notFound));
      if (!(await verifyApiKey(ApiKeyType.Ai, key)))
        return reply.code(400).send(errorResponse('verification failed'));
      const enc = encryptKey(key);
      await setAiKey(id, enc);
      return { key: '<REDACTED>' };
    },
  );

  app.delete(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      const row = await getAiKeyRow(id);
      if (row?.is_shared)
        return reply
          .code(403)
          .send(errorResponse(ERROR_MESSAGES.forbidden));
      if (!row?.ai_api_key_enc)
        return reply
          .code(404)
          .send(errorResponse(ERROR_MESSAGES.notFound));
      const agents = await getActiveAgentsByUser(id);
      for (const agent of agents) {
        removeAgentFromSchedule(agent.id);
        const token1 = agent.tokens[0].token;
        const token2 = agent.tokens[1].token;
        try {
          await cancelOpenOrders(id, {
            symbol: `${token1}${token2}`,
          });
        } catch (err) {
          req.log.error({ err, agentId: agent.id }, 'failed to cancel open orders');
        }
      }
      await draftAgentsByUser(id);
      await clearAiKey(id);
      return { ok: true };
    },
  );

  app.post(
    '/users/:id/ai-key/share',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      const adminId = await requireAdmin(req, reply);
      if (!adminId || adminId !== id) return;
      const { email } = req.body as { email: string };
      const row = await getAiKeyRow(id);
      const err = ensureKeyPresent(row, ['ai_api_key_enc']);
      if (err) return reply.code(err.code).send(err.body);
      const target = await findUserByEmail(email);
      if (!target) return reply.code(404).send(errorResponse('user not found'));
      await shareAiKey(id, target.id);
      return { ok: true };
    },
  );

  app.delete(
    '/users/:id/ai-key/share',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      const adminId = await requireAdmin(req, reply);
      if (!adminId || adminId !== id) return;
      const { email } = req.body as { email: string };
      const target = await findUserByEmail(email);
      if (!target) return reply.code(404).send(errorResponse('user not found'));
      if (!(await hasAiKeyShare(id, target.id)))
        return reply.code(404).send(errorResponse('share not found'));
      const agents = await getActiveAgentsByUser(target.id);
      for (const agent of agents) {
        removeAgentFromSchedule(agent.id);
        const token1 = agent.tokens[0].token;
        const token2 = agent.tokens[1].token;
        try {
          await cancelOpenOrders(target.id, { symbol: `${token1}${token2}` });
        } catch (err) {
          req.log.error({ err, agentId: agent.id }, 'failed to cancel open orders');
        }
      }
      await draftAgentsByUser(target.id);
      await revokeAiKeyShare(id, target.id);
      return { ok: true };
    },
  );

  app.post(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      const { key, secret } = req.body as { key: string; secret: string };
      const row = await getBinanceKeyRow(id);
      let err = ensureUser(row);
      if (err) return reply.code(err.code).send(err.body);
      err = ensureKeyAbsent(row, ['binance_api_key_enc', 'binance_api_secret_enc']);
      if (err) return reply.code(err.code).send(err.body);
      const verRes = await verifyApiKey(ApiKeyType.Binance, key, secret);
      if (verRes !== true)
        return reply
          .code(400)
          .send(
            errorResponse(
              `verification failed${
                typeof verRes === 'string' ? `: ${verRes}` : ''
              }`,
            ),
          );
      const encKey = encryptKey(key);
      const encSecret = encryptKey(secret);
      await setBinanceKey(id, encKey, encSecret);
      return { key: '<REDACTED>', secret: '<REDACTED>' };
    },
  );

  app.get(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      const row = await getBinanceKeyRow(id);
      const err = ensureKeyPresent(row, [
        'binance_api_key_enc',
        'binance_api_secret_enc',
      ]);
      if (err) return reply.code(err.code).send(err.body);
      const key = decryptKey(row!.binance_api_key_enc!);
      const secret = decryptKey(row!.binance_api_secret_enc!);
      return { key: '<REDACTED>', secret: '<REDACTED>' };
    },
  );

  app.put(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      const { key, secret } = req.body as { key: string; secret: string };
      const row = await getBinanceKeyRow(id);
      const err = ensureKeyPresent(row, [
        'binance_api_key_enc',
        'binance_api_secret_enc',
      ]);
      if (err) return reply.code(err.code).send(err.body);
      const verRes = await verifyApiKey(ApiKeyType.Binance, key, secret);
      if (verRes !== true)
        return reply
          .code(400)
          .send(
            errorResponse(
              `verification failed${
                typeof verRes === 'string' ? `: ${verRes}` : ''
              }`,
            ),
          );
      const encKey = encryptKey(key);
      const encSecret = encryptKey(secret);
      await setBinanceKey(id, encKey, encSecret);
      return { key: '<REDACTED>', secret: '<REDACTED>' };
    },
  );

  app.delete(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const params = parseParams(idParams, req.params, reply);
      if (!params) return;
      const { id } = params;
      if (!requireUserIdMatch(req, reply, id)) return;
      const row = await getBinanceKeyRow(id);
      const err = ensureKeyPresent(row, [
        'binance_api_key_enc',
        'binance_api_secret_enc',
      ]);
      if (err) return reply.code(err.code).send(err.body);
      const agents = await getActiveAgentsByUser(id);
      for (const agent of agents) {
        removeAgentFromSchedule(agent.id);
        const token1 = agent.tokens[0].token;
        const token2 = agent.tokens[1].token;
        try {
          await cancelOpenOrders(id, {
            symbol: `${token1}${token2}`,
          });
        } catch (err) {
          req.log.error({ err, agentId: agent.id }, 'failed to cancel open orders');
        }
      }
      await deactivateAgentsByUser(id);
      await clearBinanceKey(id);
      return { ok: true };
    },
  );
}
