import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { createHmac } from 'node:crypto';

export default async function binanceBalanceRoutes(app: FastifyInstance) {
  app.get('/users/:id/binance-balance', async (req, reply) => {
    const id = (req.params as any).id;
    const userId = req.headers['x-user-id'] as string | undefined;
    if (!userId || userId !== id) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const row = db
      .prepare(
        'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
      )
      .get(id) as
      | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
      | undefined;
    if (!row || !row.binance_api_key_enc || !row.binance_api_secret_enc) {
      return reply.code(404).send({ error: 'not found' });
    }
    const key = decrypt(row.binance_api_key_enc, env.KEY_PASSWORD);
    const secret = decrypt(row.binance_api_secret_enc, env.KEY_PASSWORD);
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = createHmac('sha256', secret)
      .update(query)
      .digest('hex');
    const accountRes = await fetch(
      `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
      { headers: { 'X-MBX-APIKEY': key } }
    );
    if (!accountRes.ok) return reply.code(500).send({ error: 'failed to fetch account' });
    const account = (await accountRes.json()) as {
      balances: { asset: string; free: string; locked: string }[];
    };
    let total = 0;
    for (const b of account.balances) {
      const amount = Number(b.free) + Number(b.locked);
      if (!amount) continue;
      if (b.asset === 'USDT') {
        total += amount;
        continue;
      }
      const priceRes = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${b.asset}USDT`
      );
      if (!priceRes.ok) continue;
      const priceJson = (await priceRes.json()) as { price: string };
      total += amount * Number(priceJson.price);
    }
    return { totalUsd: total };
  });
}
