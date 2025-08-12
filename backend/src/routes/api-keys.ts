import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { encrypt, decrypt } from '../util/crypto.js';

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
    const enc = encrypt(key, env.KEY_PASSWORD);
    db.prepare('UPDATE users SET ai_api_key_enc = ? WHERE id = ?').run(enc, id);
    return { key };
  });

  app.get('/users/:id/ai-key', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get(id) as { ai_api_key_enc?: string } | undefined;
    if (!row || !row.ai_api_key_enc)
      return reply.code(404).send({ error: 'not found' });
    const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);
    return { key };
  });

  app.put('/users/:id/ai-key', async (req, reply) => {
    const id = (req.params as any).id;
    const { key } = req.body as { key: string };
    const row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get(id) as { ai_api_key_enc?: string } | undefined;
    if (!row || !row.ai_api_key_enc)
      return reply.code(404).send({ error: 'not found' });
    const enc = encrypt(key, env.KEY_PASSWORD);
    db.prepare('UPDATE users SET ai_api_key_enc = ? WHERE id = ?').run(enc, id);
    return { key };
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
    const { key } = req.body as { key: string };
    const row = db
      .prepare<[string], { binance_api_key_enc?: string }>(
        'SELECT binance_api_key_enc FROM users WHERE id = ?'
      )
      .get(id);
    if (!row) return reply.code(404).send({ error: 'user not found' });
    if (row.binance_api_key_enc) return reply.code(400).send({ error: 'key exists' });
    const enc = encrypt(key, env.KEY_PASSWORD);
    db.prepare('UPDATE users SET binance_api_key_enc = ? WHERE id = ?').run(enc, id);
    return { key };
  });

  app.get('/users/:id/binance-key', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT binance_api_key_enc FROM users WHERE id = ?')
      .get(id) as { binance_api_key_enc?: string } | undefined;
    if (!row || !row.binance_api_key_enc)
      return reply.code(404).send({ error: 'not found' });
    const key = decrypt(row.binance_api_key_enc, env.KEY_PASSWORD);
    return { key };
  });

  app.put('/users/:id/binance-key', async (req, reply) => {
    const id = (req.params as any).id;
    const { key } = req.body as { key: string };
    const row = db
      .prepare('SELECT binance_api_key_enc FROM users WHERE id = ?')
      .get(id) as { binance_api_key_enc?: string } | undefined;
    if (!row || !row.binance_api_key_enc)
      return reply.code(404).send({ error: 'not found' });
    const enc = encrypt(key, env.KEY_PASSWORD);
    db.prepare('UPDATE users SET binance_api_key_enc = ? WHERE id = ?').run(enc, id);
    return { key };
  });

  app.delete('/users/:id/binance-key', async (req, reply) => {
    const id = (req.params as any).id;
    const row = db
      .prepare('SELECT binance_api_key_enc FROM users WHERE id = ?')
      .get(id) as { binance_api_key_enc?: string } | undefined;
    if (!row || !row.binance_api_key_enc)
      return reply.code(404).send({ error: 'not found' });
    db.prepare('UPDATE users SET binance_api_key_enc = NULL WHERE id = ?').run(id);
    return { ok: true };
  });
}
