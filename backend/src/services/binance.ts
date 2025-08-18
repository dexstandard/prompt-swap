import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { createHmac } from 'node:crypto';

export async function fetchAccount(id: string) {
  const row = db
    .prepare(
      'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?'
    )
    .get(id) as
    | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
    | undefined;
  if (!row?.binance_api_key_enc || !row.binance_api_secret_enc) return null;

  const key = decrypt(row.binance_api_key_enc, env.KEY_PASSWORD);
  const secret = decrypt(row.binance_api_secret_enc, env.KEY_PASSWORD);
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = createHmac('sha256', secret).update(query).digest('hex');
  const accountRes = await fetch(
    `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
    { headers: { 'X-MBX-APIKEY': key } }
  );
  if (!accountRes.ok) throw new Error('failed to fetch account');
  return (await accountRes.json()) as {
    balances: { asset: string; free: string; locked: string }[];
  };
}

export async function fetchTotalBalanceUsd(id: string) {
  const account = await fetchAccount(id);
  if (!account) return null;
  let total = 0;
  for (const b of account.balances) {
    const amount = Number(b.free) + Number(b.locked);
    if (!amount) continue;
    if (b.asset === 'USDT') {
      total += amount;
      continue;
    }
    const priceRes = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${b.asset}USDT`,
    );
    if (!priceRes.ok) continue;
    const priceJson = (await priceRes.json()) as { price: string };
    total += amount * Number(priceJson.price);
  }
  return total;
}
