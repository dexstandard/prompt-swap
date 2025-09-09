export async function fetchOpenInterest(symbol: string) {
  const res = await fetch(
    `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`failed to fetch open interest: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { openInterest: string };
  return Number(json.openInterest);
}

export async function fetchFundingRate(symbol: string) {
  const res = await fetch(
    `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`failed to fetch funding rate: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { fundingRate: string }[];
  const latest = json[0];
  return Number(latest?.fundingRate ?? 0);
}

export async function fetchOrderBook(symbol: string) {
  const res = await fetch(
    `https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=5`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`failed to fetch order book: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    bids: [string, string][];
    asks: [string, string][];
  };
  const [bestBidP, bestBidQ] = json.bids[0] || ["0", "0"];
  const [bestAskP, bestAskQ] = json.asks[0] || ["0", "0"];
  return {
    bid: [Number(bestBidP), Number(bestBidQ)] as [number, number],
    ask: [Number(bestAskP), Number(bestAskQ)] as [number, number],
  };
}

