import type { FastifyInstance } from 'fastify';
import { RATE_LIMITS } from '../rate-limit.js';
import {
  getAiKeyRow,
  setAiKey,
  clearAiKey,
  getBinanceKeyRow,
  setBinanceKey,
  clearBinanceKey,
} from '../repos/api-keys.js';
import { redactKey } from '../util/redact.js';
import {
  ApiKeyType,
  verifyApiKey,
  encryptKey,
  decryptKey,
  ensureUser,
  ensureKeyAbsent,
  ensureKeyPresent,
} from '../util/api-keys.js';

export default async function apiKeyRoutes(app: FastifyInstance) {
  app.post(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const id = Number((req.params as any).id);
      const { key } = req.body as { key: string };
      const row = await getAiKeyRow(id);
      let err = ensureUser(row);
      if (err) return reply.code(err.code).send(err.body);
      err = ensureKeyAbsent(row, ['ai_api_key_enc']);
      if (err) return reply.code(err.code).send(err.body);
      if (!(await verifyApiKey(ApiKeyType.Ai, key)))
        return reply.code(400).send({ error: 'verification failed' });
      const enc = encryptKey(key);
      await setAiKey(id, enc);
      return { key: redactKey(key) };
    },
  );

  app.get(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const id = Number((req.params as any).id);
      const row = await getAiKeyRow(id);
      const err = ensureKeyPresent(row, ['ai_api_key_enc']);
      if (err) return reply.code(err.code).send(err.body);
      const key = decryptKey(row!.ai_api_key_enc!);
      return { key: redactKey(key) };
    },
  );

  app.put(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const id = Number((req.params as any).id);
      const { key } = req.body as { key: string };
      const row = await getAiKeyRow(id);
      const err = ensureKeyPresent(row, ['ai_api_key_enc']);
      if (err) return reply.code(err.code).send(err.body);
      if (!(await verifyApiKey(ApiKeyType.Ai, key)))
        return reply.code(400).send({ error: 'verification failed' });
      const enc = encryptKey(key);
      await setAiKey(id, enc);
      return { key: redactKey(key) };
    },
  );

  app.delete(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const id = Number((req.params as any).id);
      const row = await getAiKeyRow(id);
      const err = ensureKeyPresent(row, ['ai_api_key_enc']);
      if (err) return reply.code(err.code).send(err.body);
      await clearAiKey(id);
      return { ok: true };
    },
  );

  app.post(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const id = Number((req.params as any).id);
      const { key, secret } = req.body as { key: string; secret: string };
      const row = await getBinanceKeyRow(id);
      let err = ensureUser(row);
      if (err) return reply.code(err.code).send(err.body);
      err = ensureKeyAbsent(row, ['binance_api_key_enc', 'binance_api_secret_enc']);
      if (err) return reply.code(err.code).send(err.body);
      if (!(await verifyApiKey(ApiKeyType.Binance, key, secret)))
        return reply.code(400).send({ error: 'verification failed' });
      const encKey = encryptKey(key);
      const encSecret = encryptKey(secret);
      await setBinanceKey(id, encKey, encSecret);
      return { key: redactKey(key), secret: redactKey(secret) };
    },
  );

  app.get(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const id = Number((req.params as any).id);
      const row = await getBinanceKeyRow(id);
      const err = ensureKeyPresent(row, [
        'binance_api_key_enc',
        'binance_api_secret_enc',
      ]);
      if (err) return reply.code(err.code).send(err.body);
      const key = decryptKey(row!.binance_api_key_enc!);
      const secret = decryptKey(row!.binance_api_secret_enc!);
      return { key: redactKey(key), secret: redactKey(secret) };
    },
  );

  app.put(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const id = Number((req.params as any).id);
      const { key, secret } = req.body as { key: string; secret: string };
      const row = await getBinanceKeyRow(id);
      const err = ensureKeyPresent(row, [
        'binance_api_key_enc',
        'binance_api_secret_enc',
      ]);
      if (err) return reply.code(err.code).send(err.body);
      if (!(await verifyApiKey(ApiKeyType.Binance, key, secret)))
        return reply.code(400).send({ error: 'verification failed' });
      const encKey = encryptKey(key);
      const encSecret = encryptKey(secret);
      await setBinanceKey(id, encKey, encSecret);
      return { key: redactKey(key), secret: redactKey(secret) };
    },
  );

  app.delete(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const row = await getBinanceKeyRow(id);
      const err = ensureKeyPresent(row, [
        'binance_api_key_enc',
        'binance_api_secret_enc',
      ]);
      if (err) return reply.code(err.code).send(err.body);
      await clearBinanceKey(id);
      return { ok: true };
    },
  );
}
