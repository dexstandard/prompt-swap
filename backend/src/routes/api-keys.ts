import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { encrypt, decrypt } from '../util/crypto.js';
import { redactKey } from '../util/redact.js';
import { createHmac } from 'node:crypto';

async function isValidOpenAIKey(key: string) {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function isValidBinanceKey(key: string, secret: string) {
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

export default async function apiKeyRoutes(app: FastifyInstance) {
  app.post('/users/:id/ai-key', async (req, reply) => {
    const id = (req.params as any).id;
    const { key } = req.body as { key: string };
    const row = db
      .prepare<[string], { ai_api_key_enc?: string }>(
        'SELECT ai_api_key_enc FROM users WHERE id = ?'
      )
      .get(id);
    if (!row) return reply.code(404).send({ error: 'user not found' });
    if (row.ai_api_key_enc) return reply.code(400).send({ error: 'key exists' });
    if (!(await isValidOpenAIKey(key)))
      return reply.code(400).send({ error: 'invalid key' });
    const enc = encrypt(key, env.KEY_PASSWORD);
    db.prepare('UPDATE users SET ai_api_key_enc = ? WHERE id = ?').run(enc, id);
    return { key: redactKey(key) };
  });

  app.get('/users/:id/ai-key', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get(id) as { ai_api_key_enc?: string } | undefined;
    if (!row || !row.ai_api_key_enc)
      return reply.code(404).send({ error: 'not found' });
    const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);
    return { key: redactKey(key) };
  });

  app.put('/users/:id/ai-key', async (req, reply) => {
    const id = (req.params as any).id;
    const { key } = req.body as { key: string };
    const row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get(id) as { ai_api_key_enc?: string } | undefined;
    if (!row || !row.ai_api_key_enc)
      return reply.code(404).send({ error: 'not found' });
    if (!(await isValidOpenAIKey(key)))
      return reply.code(400).send({ error: 'invalid key' });
    const enc = encrypt(key, env.KEY_PASSWORD);
    db.prepare('UPDATE users SET ai_api_key_enc = ? WHERE id = ?').run(enc, id);
    return { key: redactKey(key) };
  });

  app.delete('/users/:id/ai-key', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get(id) as { ai_api_key_enc?: string } | undefined;
    if (!row || !row.ai_api_key_enc)
      return reply.code(404).send({ error: 'not found' });
    db.prepare('UPDATE users SET ai_api_key_enc = NULL WHERE id = ?').run(id);
    return { ok: true };
  });

  app.post('/users/:id/binance-key', async (req, reply) => {
    const id = (req.params as any).id;
    const { key, secret } = req.body as { key: string; secret: string };
    const row = db
      .prepare<
        [string],
        { binance_api_key_enc?: string; binance_api_secret_enc?: string }
      >('SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?')
      .get(id);
    if (!row) return reply.code(404).send({ error: 'user not found' });
    if (row.binance_api_key_enc || row.binance_api_secret_enc)
      return reply.code(400).send({ error: 'key exists' });
    if (!(await isValidBinanceKey(key, secret)))
      return reply.code(400).send({ error: 'invalid key' });
    const encKey = encrypt(key, env.KEY_PASSWORD);
    const encSecret = encrypt(secret, env.KEY_PASSWORD);
    db.prepare(
      'UPDATE users SET binance_api_key_enc = ?, binance_api_secret_enc = ? WHERE id = ?'
    ).run(encKey, encSecret, id);
    return { key: redactKey(key), secret: redactKey(secret) };
  });

  app.get('/users/:id/binance-key', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare(
        'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
      )
      .get(id) as
      | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
      | undefined;
    if (!row || !row.binance_api_key_enc || !row.binance_api_secret_enc)
      return reply.code(404).send({ error: 'not found' });
    const key = decrypt(row.binance_api_key_enc, env.KEY_PASSWORD);
    const secret = decrypt(row.binance_api_secret_enc, env.KEY_PASSWORD);
    return { key: redactKey(key), secret: redactKey(secret) };
  });

  app.put('/users/:id/binance-key', async (req, reply) => {
    const id = (req.params as any).id;
    const { key, secret } = req.body as { key: string; secret: string };
    const row = db
      .prepare(
        'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
      )
      .get(id) as
      | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
      | undefined;
    if (!row || !row.binance_api_key_enc || !row.binance_api_secret_enc)
      return reply.code(404).send({ error: 'not found' });
    if (!(await isValidBinanceKey(key, secret)))
      return reply.code(400).send({ error: 'invalid key' });
    const encKey = encrypt(key, env.KEY_PASSWORD);
    const encSecret = encrypt(secret, env.KEY_PASSWORD);
    db.prepare(
      'UPDATE users SET binance_api_key_enc = ?, binance_api_secret_enc = ? WHERE id = ?'
    ).run(encKey, encSecret, id);
    return { key: redactKey(key), secret: redactKey(secret) };
  });

  app.delete('/users/:id/binance-key', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare(
        'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
      )
      .get(id) as
      | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
      | undefined;
    if (!row || !row.binance_api_key_enc || !row.binance_api_secret_enc)
      return reply.code(404).send({ error: 'not found' });
    db.prepare(
      'UPDATE users SET binance_api_key_enc = NULL, binance_api_secret_enc = NULL WHERE id = ?'
    ).run(id);
    return { ok: true };
  });
}
