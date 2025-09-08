import { env } from '../util/env.js';
import { decrypt } from '../util/crypto.js';
import { createHmac } from 'node:crypto';
import { getBinanceKeyRow } from '../repos/api-keys.js';

type UserCreds = { key: string; secret: string };

async function getUserCreds(id: string): Promise<UserCreds | null> {
  const row = await getBinanceKeyRow(id);
  if (!row?.binance_api_key_enc || !row.binance_api_secret_enc) return null;
  const key = decrypt(row.binance_api_key_enc, env.KEY_PASSWORD);
  const secret = decrypt(row.binance_api_secret_enc, env.KEY_PASSWORD);
  return { key, secret };
}

export function parseBinanceError(err: unknown): string | null {
  if (err instanceof Error) {
    const msg = err.message;
    const start = msg.lastIndexOf('{');
    const end = msg.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const body = JSON.parse(msg.slice(start, end + 1));
        if (typeof body.msg === 'string') return body.msg;
      } catch {}
    }
  }
  return null;
}

export async function fetchAccount(id: string) {
  const creds = await getUserCreds(id);
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
  opts: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: string | number;
    price: number;
  }
) {
  const creds = await getUserCreds(id);
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
  const creds = await getUserCreds(id);
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

export async function cancelOpenOrders(
  id: string,
  opts: { symbol: string }
) {
  const creds = await getUserCreds(id);
  if (!creds) return null;
  const timestamp = Date.now();
  const params = new URLSearchParams({
    symbol: opts.symbol.toUpperCase(),
    timestamp: String(timestamp),
  });
  const signature = createHmac('sha256', creds.secret)
    .update(params.toString())
    .digest('hex');
  params.append('signature', signature);
  const res = await fetch(
    `https://api.binance.com/api/v3/openOrders?${params.toString()}`,
    {
      method: 'DELETE',
      headers: { 'X-MBX-APIKEY': creds.key },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`failed to cancel open orders: ${res.status} ${body}`);
  }
  return res.json();
}

type ExchangeInfo = {
  symbols: { filters: { filterType: string; stepSize?: string }[] }[];
};

const exchangeInfoCache = new Map<string, Promise<ExchangeInfo>>();

async function fetchExchangeInfo(symbol: string): Promise<ExchangeInfo> {
  let infoPromise = exchangeInfoCache.get(symbol);
  if (!infoPromise) {
    infoPromise = fetch(
      `https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`,
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`failed to fetch info data: ${res.status} ${body}`);
        }
        return (res.json() as Promise<ExchangeInfo>);
      })
      .catch((err) => {
        exchangeInfoCache.delete(symbol);
        throw err;
      });
    exchangeInfoCache.set(symbol, infoPromise);
  }
  return infoPromise;
}

export function __clearExchangeInfoCache() {
  exchangeInfoCache.clear();
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
  const infoJson = await fetchExchangeInfo(symbol);
  const lot = infoJson.symbols[0]?.filters.find(
    (f) => f.filterType === 'LOT_SIZE',
  );
  if (!lot?.stepSize) {
    throw new Error('missing step size for symbol');
  }
  return {
    currentPrice: Number(priceJson.price),
    orderBook: {
      bids: depthJson.bids.map(([p, q]) => [Number(p), Number(q)]),
      asks: depthJson.asks.map(([p, q]) => [Number(p), Number(q)]),
    },
    day: await dayRes.json(),
    year: yearJson,
    stepSize: Number(lot.stepSize),
  };
}

export async function fetchPairData(token1: string, token2: string) {
  const symbols = [
    `${token1}${token2}`.toUpperCase(),
    `${token2}${token1}`.toUpperCase(),
  ];
  let lastErr: unknown;
  for (const symbol of symbols) {
    try {
      const data = await fetchSymbolData(symbol);
      return { symbol, ...data };
    } catch (err) {
      lastErr = err;
      if (err instanceof Error) {
        const msg = parseBinanceError(err) ?? err.message;
        if (
          /Invalid symbol/i.test(msg) ||
          /code"?\s*:\s*-1121/.test(msg)
        ) {
          continue;
        }
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
