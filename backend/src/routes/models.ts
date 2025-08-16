import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';

export default async function modelsRoutes(app: FastifyInstance) {
  app.get('/users/:id/models', async (req, reply) => {
    const id = (req.params as any).id;
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId || userId !== id) return reply.code(403).send({ error: 'forbidden' });
    const row = db
      .prepare('SELECT ai_api_key_enc FROM users WHERE id = ?')
      .get(id) as { ai_api_key_enc?: string } | undefined;
    if (!row?.ai_api_key_enc) return reply.code(404).send({ error: 'not found' });
    const key = decrypt(row.ai_api_key_enc, env.KEY_PASSWORD);
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return reply.code(500).send({ error: 'failed to fetch models' });
      const json = await res.json();
      const models = (json.data as { id: string }[])
        .map((m) => m.id)
        .filter((id: string) => /^(gpt-5|o3|gpt-4\.1|gpt-4o)/.test(id));
      return { models };
    } catch {
      return reply.code(500).send({ error: 'failed to fetch models' });
    }
  });
}
