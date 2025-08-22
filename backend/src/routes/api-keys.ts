import type { FastifyInstance } from 'fastify';
import { env } from '../util/env.js';
import { encrypt, decrypt } from '../util/crypto.js';
import { redactKey } from '../util/redact.js';
import { createHmac } from 'node:crypto';
import { RATE_LIMITS } from '../rate-limit.js';
import {
  getAiKeyRow,
  setAiKey,
  clearAiKey,
  getBinanceKeyRow,
  setBinanceKey,
  clearBinanceKey,
} from '../repos/api-keys.js';

interface ValidationErr {
  code: number;
  body: unknown;
}

async function verifyOpenAIKey(key: string) {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function verifyBinanceKey(key: string, secret: string) {
  try {
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = createHmac('sha256', secret)
      .update(query)
      .digest('hex');
    const res = await fetch(
      `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': key },
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

function ensureUser(row: unknown): ValidationErr | null {
  if (!row) return { code: 404, body: { error: 'user not found' } };
  return null;
}

function ensureAiKeyAbsent(row: { ai_api_key_enc?: string } | undefined) {
  if (row?.ai_api_key_enc) return { code: 400, body: { error: 'key exists' } };
  return null;
}

function ensureAiKeyPresent(row: { ai_api_key_enc?: string } | undefined) {
  if (!row?.ai_api_key_enc) return { code: 404, body: { error: 'not found' } };
  return null;
}

function ensureBinanceKeyAbsent(
  row:
    | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
    | undefined,
) {
  if (row?.binance_api_key_enc || row?.binance_api_secret_enc)
    return { code: 400, body: { error: 'key exists' } };
  return null;
}

function ensureBinanceKeyPresent(
  row:
    | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
    | undefined,
) {
  if (!row?.binance_api_key_enc || !row?.binance_api_secret_enc)
    return { code: 404, body: { error: 'not found' } };
  return null;
}

export default async function apiKeyRoutes(app: FastifyInstance) {
  app.post(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const { key } = req.body as { key: string };
    const row = getAiKeyRow(id);
    let err = ensureUser(row);
    if (err) return reply.code(err.code).send(err.body);
    err = ensureAiKeyAbsent(row);
    if (err) return reply.code(err.code).send(err.body);
    if (!(await verifyOpenAIKey(key)))
      return reply.code(400).send({ error: 'verification failed' });
    const enc = encrypt(key, env.KEY_PASSWORD);
    setAiKey(id, enc);
      return { key: redactKey(key) };
    }
  );

  app.get(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const row = getAiKeyRow(id);
      const err = ensureAiKeyPresent(row);
      if (err) return reply.code(err.code).send(err.body);
      const key = decrypt(row!.ai_api_key_enc!, env.KEY_PASSWORD);
      return { key: redactKey(key) };
    }
  );

  app.put(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const { key } = req.body as { key: string };
      const row = getAiKeyRow(id);
      const err = ensureAiKeyPresent(row);
      if (err) return reply.code(err.code).send(err.body);
      if (!(await verifyOpenAIKey(key)))
        return reply.code(400).send({ error: 'verification failed' });
      const enc = encrypt(key, env.KEY_PASSWORD);
      setAiKey(id, enc);
      return { key: redactKey(key) };
    }
  );

  app.delete(
    '/users/:id/ai-key',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const row = getAiKeyRow(id);
      const err = ensureAiKeyPresent(row);
      if (err) return reply.code(err.code).send(err.body);
      clearAiKey(id);
      return { ok: true };
    }
  );

  app.post(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const { key, secret } = req.body as { key: string; secret: string };
    const row = getBinanceKeyRow(id);
    let err = ensureUser(row);
    if (err) return reply.code(err.code).send(err.body);
    err = ensureBinanceKeyAbsent(row);
    if (err) return reply.code(err.code).send(err.body);
    if (!(await verifyBinanceKey(key, secret)))
      return reply.code(400).send({ error: 'verification failed' });
    const encKey = encrypt(key, env.KEY_PASSWORD);
    const encSecret = encrypt(secret, env.KEY_PASSWORD);
    setBinanceKey(id, encKey, encSecret);
      return { key: redactKey(key), secret: redactKey(secret) };
    }
  );

  app.get(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.MODERATE } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const row = getBinanceKeyRow(id);
      const err = ensureBinanceKeyPresent(row);
      if (err) return reply.code(err.code).send(err.body);
      const key = decrypt(row!.binance_api_key_enc!, env.KEY_PASSWORD);
      const secret = decrypt(row!.binance_api_secret_enc!, env.KEY_PASSWORD);
      return { key: redactKey(key), secret: redactKey(secret) };
    }
  );

  app.put(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.TIGHT } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const { key, secret } = req.body as { key: string; secret: string };
      const row = getBinanceKeyRow(id);
      const err = ensureBinanceKeyPresent(row);
      if (err) return reply.code(err.code).send(err.body);
      if (!(await verifyBinanceKey(key, secret)))
        return reply.code(400).send({ error: 'verification failed' });
      const encKey = encrypt(key, env.KEY_PASSWORD);
      const encSecret = encrypt(secret, env.KEY_PASSWORD);
      setBinanceKey(id, encKey, encSecret);
      return { key: redactKey(key), secret: redactKey(secret) };
    }
  );

  app.delete(
    '/users/:id/binance-key',
    { config: { rateLimit: RATE_LIMITS.VERY_TIGHT } },
    async (req, reply) => {
      const id = (req.params as any).id;
      const row = getBinanceKeyRow(id);
      const err = ensureBinanceKeyPresent(row);
      if (err) return reply.code(err.code).send(err.body);
      clearBinanceKey(id);
      return { ok: true };
    }
  );
}
