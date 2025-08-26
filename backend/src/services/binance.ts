import { db } from '../db/index.js';
import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { createHmac } from 'node:crypto';

type UserCreds = { key: string; secret: string };

function getUserCreds(id: string): UserCreds | null {
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
  return { key, secret };
}

export async function fetchAccount(id: string) {
  const creds = getUserCreds(id);
  if (!creds) return null;
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = createHmac('sha256', creds.secret).update(query).digest('hex');
  const accountRes = await fetch(
    `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
    { headers: { 'X-MBX-APIKEY': creds.key } }
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

export async function fetchTokensBalanceUsd(id: string, tokens: string[]) {
  const account = await fetchAccount(id);
  if (!account) return null;
  const wanted = new Set(tokens.map((t) => t.toUpperCase()));
  let total = 0;
  for (const b of account.balances) {
    if (!wanted.has(b.asset.toUpperCase())) continue;
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

export async function createLimitOrder(
  id: string,
  opts: { symbol: string; side: 'BUY' | 'SELL'; quantity: number; price: number }
) {
  const creds = getUserCreds(id);
  if (!creds) return null;
  const timestamp = Date.now();
  const params = new URLSearchParams({
    symbol: opts.symbol.toUpperCase(),
    side: opts.side,
    type: 'LIMIT',
    timeInForce: 'GTC',
    quantity: String(opts.quantity),
    price: String(opts.price),
    timestamp: String(timestamp),
  });
  const signature = createHmac('sha256', creds.secret)
    .update(params.toString())
    .digest('hex');
  params.append('signature', signature);
  const res = await fetch(`https://api.binance.com/api/v3/order`, {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': creds.key,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`failed to create order: ${res.status} ${body}`);
  }
  return res.json();
}

export async function cancelOrder(
  id: string,
  opts: { symbol: string; orderId: number }
) {
  const creds = getUserCreds(id);
  if (!creds) return null;
  const timestamp = Date.now();
  const params = new URLSearchParams({
    symbol: opts.symbol.toUpperCase(),
    orderId: String(opts.orderId),
    timestamp: String(timestamp),
  });
  const signature = createHmac('sha256', creds.secret)
    .update(params.toString())
    .digest('hex');
  params.append('signature', signature);
  const res = await fetch(
    `https://api.binance.com/api/v3/order?${params.toString()}`,
    {
      method: 'DELETE',
      headers: { 'X-MBX-APIKEY': creds.key },
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`failed to cancel order: ${res.status} ${body}`);
  }
  return res.json();
}

async function fetchSymbolData(symbol: string) {
  const [priceRes, depthRes, dayRes, yearRes] = await Promise.all([
    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
    fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=5`),
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
    fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=365`,
    ),
  ]);
  const responses = {
    price: priceRes,
    depth: depthRes,
    day: dayRes,
    year: yearRes,
  } as const;
  for (const [name, res] of Object.entries(responses)) {
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`failed to fetch ${name} data: ${res.status} ${body}`);
    }
  }
  const priceJson = (await priceRes.json()) as { price: string };
  const depthJson = (await depthRes.json()) as {
    bids: [string, string][];
    asks: [string, string][];
  };
  const yearJson = (await yearRes.json()) as unknown[];
  return {
    currentPrice: Number(priceJson.price),
    orderBook: {
      bids: depthJson.bids.map(([p, q]) => [Number(p), Number(q)]),
      asks: depthJson.asks.map(([p, q]) => [Number(p), Number(q)]),
    },
    day: await dayRes.json(),
    year: yearJson,
  };
}

export async function fetchPairData(tokenA: string, tokenB: string) {
  const symbols = [
    `${tokenA}${tokenB}`.toUpperCase(),
    `${tokenB}${tokenA}`.toUpperCase(),
  ];
  let lastErr: unknown;
  for (const symbol of symbols) {
    try {
      return await fetchSymbolData(symbol);
    } catch (err) {
      lastErr = err;
      if (err instanceof Error && /Invalid symbol/i.test(err.message)) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchMarketTimeseries(symbol: string) {
  const [minRes, hourRes, monthRes] = await Promise.all([
    fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=60`,
    ),
    fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`,
    ),
    fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1M&limit=24`,
    ),
  ]);

  const responses = {
    minute_60: minRes,
    hourly_24h: hourRes,
    monthly_24m: monthRes,
  } as const;
  for (const [name, res] of Object.entries(responses)) {
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`failed to fetch ${name} data: ${res.status} ${body}`);
    }
  }

  const [minJson, hourJson, monthJson] = await Promise.all([
    minRes.json(),
    hourRes.json(),
    monthRes.json(),
  ]);

  return {
    minute_60: (minJson as any[]).map(
      (k: any) =>
        [
          Number(k[0]),
          Number(k[1]),
          Number(k[4]),
          Number(k[5]),
        ] as [number, number, number, number],
    ),
    hourly_24h: (hourJson as any[]).map(
      (k: any) =>
        [
          Number(k[0]),
          Number(k[1]),
          Number(k[4]),
          Number(k[5]),
        ] as [number, number, number, number],
    ),
    monthly_24m: (monthJson as any[]).map(
      (k: any) =>
        [Number(k[0]), Number(k[1]), Number(k[4])] as [
          number,
          number,
          number,
        ],
    ),
  };
}
