import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { createHmac } from 'node:crypto';

async function fetchAccount(
  id: string,
  userId: string | undefined,
  reply: FastifyReply
) {
  if (!userId || userId !== id) {
    reply.code(403).send({ error: 'forbidden' });
    return null;
  }
  const row = db
    .prepare(
      'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
    )
    .get(id) as
    | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
    | undefined;
  if (!row || !row.binance_api_key_enc || !row.binance_api_secret_enc) {
    reply.code(404).send({ error: 'not found' });
    return null;
  }
  const key = decrypt(row.binance_api_key_enc, env.KEY_PASSWORD);
  const secret = decrypt(row.binance_api_secret_enc, env.KEY_PASSWORD);
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = createHmac('sha256', secret).update(query).digest('hex');
  const accountRes = await fetch(
    `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
    { headers: { 'X-MBX-APIKEY': key } }
  );
  if (!accountRes.ok) {
    reply.code(500).send({ error: 'failed to fetch account' });
    return null;
  }
  return (await accountRes.json()) as {
    balances: { asset: string; free: string; locked: string }[];
  };
}

export default async function binanceBalanceRoutes(app: FastifyInstance) {
  app.get('/users/:id/binance-balance', async (req, reply) => {
    const id = (req.params as any).id;
    const userId = req.headers['x-user-id'] as string | undefined;
    const account = await fetchAccount(id, userId, reply);
    if (!account) return;
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

  app.get('/users/:id/binance-balance/:token', async (req, reply) => {
    const { id, token } = req.params as any;
    const userId = req.headers['x-user-id'] as string | undefined;
    const account = await fetchAccount(id, userId, reply);
    if (!account) return;
    const sym = (token as string).toUpperCase();
    const bal = account.balances.find((b) => b.asset === sym);
    if (!bal) return { asset: sym, free: 0, locked: 0 };
    return {
      asset: sym,
      free: Number(bal.free),
      locked: Number(bal.locked),
    };
  });
}
