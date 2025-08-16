import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../db/index.js';

export default async function binancePricesRoutes(app: FastifyInstance) {
  app.get('/users/:id/binance-prices/:symbol', async (req, reply: FastifyReply) => {
    const { id, symbol } = req.params as any;
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId || userId !== id) {
      reply.code(403).send({ error: 'forbidden' });
      return;
    }
    const row = db
      .prepare(
        'SELECT binance_api_key_enc FROM users WHERE id = ?'
      )
      .get(id) as { binance_api_key_enc?: string } | undefined;
    if (!row || !row.binance_api_key_enc) {
      reply.code(404).send({ error: 'not found' });
      return;
    }
    const sym = String(symbol).toUpperCase();
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=1d&limit=30`
      );
      if (!res.ok) {
        reply.code(500).send({ error: 'failed to fetch prices' });
        return;
      }
      const json = (await res.json()) as any[];
      return {
        prices: json.map((d) => ({ time: d[0], close: Number(d[4]) })),
      };
    } catch {
      reply.code(500).send({ error: 'failed to fetch prices' });
    }
  });
}
