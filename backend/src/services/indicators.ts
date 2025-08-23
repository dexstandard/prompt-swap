import { fetchPairData } from './binance.js';

function pctChange(current: number, past: number) {
  return ((current - past) / past) * 100;
}

function sliceMean(arr: number[]) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function calcRet(series: number[], periodsAgo: number, current: number) {
  const past = series[series.length - 1 - periodsAgo];
  return pctChange(current, past);
}

function calcSmaDist(series: number[], period: number, current: number) {
  const slice = series.slice(-period);
  const sma = sliceMean(slice);
  return pctChange(current, sma);
}

function emaSeries(values: number[], period: number) {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = values[0];
  ema.push(prev);
  for (let i = 1; i < values.length; i++) {
    const val = values[i] * k + prev * (1 - k);
    ema.push(val);
    prev = val;
  }
  return ema;
}

function calcMacdHist(closes: number[]) {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = emaSeries(macd, 9);
  return macd[macd.length - 1] - signal[signal.length - 1];
}

function realizedVol(closes: number[], days: number) {
  const returns: number[] = [];
  for (let i = closes.length - days; i < closes.length; i++) {
    const prev = closes[i - 1];
    returns.push(Math.log(closes[i] / prev));
  }
  const mean = sliceMean(returns);
  const variance = sliceMean(returns.map((r) => (r - mean) ** 2));
  return Math.sqrt(variance) * Math.sqrt(365) * 100;
}

function calcAtr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
) {
  const trs: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const prev = closes[i - 1];
    const tr = Math.max(h - l, Math.abs(h - prev), Math.abs(l - prev));
    trs.push(tr);
  }
  return sliceMean(trs);
}

function bollingerBandwidth(closes: number[], period: number) {
  const slice = closes.slice(-period);
  const sma = sliceMean(slice);
  const variance = sliceMean(slice.map((v) => (v - sma) ** 2));
  const std = Math.sqrt(variance);
  const upper = sma + 2 * std;
  const lower = sma - 2 * std;
  return ((upper - lower) / sma) * 100;
}

function donchian(
  highs: number[],
  lows: number[],
  current: number,
  period: number,
) {
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  return ((h - l) / current) * 100;
}

function volumeZ(volumes: number[], lookback: number) {
  const slice = volumes.slice(-lookback - 1, -1);
  const mean = sliceMean(slice);
  const variance = sliceMean(slice.map((v) => (v - mean) ** 2));
  const std = Math.sqrt(variance) || 1;
  const last = volumes[volumes.length - 1];
  return (last - mean) / std;
}

function dailyReturns(closes: number[], periods: number) {
  const res: number[] = [];
  for (let i = closes.length - periods - 1; i < closes.length - 1; i++) {
    res.push((closes[i + 1] - closes[i]) / closes[i]);
  }
  return res;
}

function correlation(a: number[], b: number[]) {
  const meanA = sliceMean(a);
  const meanB = sliceMean(b);
  let num = 0,
    denA = 0,
    denB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  return num / Math.sqrt(denA * denB);
}

export async function fetchTokenIndicators(token: string) {
  const pair = await fetchPairData(token, 'USDT');
  const symbol = `${token}USDT`.toUpperCase();
  const hourRes = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`,
  );
  if (!hourRes.ok) {
    const body = await hourRes.text();
    throw new Error(`failed to fetch hourly data: ${hourRes.status} ${body}`);
  }
  const hourJson = (await hourRes.json()) as unknown[];
  const hourCloses = hourJson.map((k: any) => Number(k[4]));
  const hourVolumes = hourJson.map((k: any) => Number(k[5]));

  const dayCloses = pair.year.map((k: any) => Number(k[4]));
  const dayHighs = pair.year.map((k: any) => Number(k[2]));
  const dayLows = pair.year.map((k: any) => Number(k[3]));
  const dayVolumes = pair.year.map((k: any) => Number(k[5]));
  const current = pair.currentPrice;

  const ret = {
    '1h': calcRet(hourCloses, 1, current),
    '4h': calcRet(hourCloses, 4, current),
    '24h': calcRet(dayCloses, 1, current),
    '7d': calcRet(dayCloses, 7, current),
    '30d': calcRet(dayCloses, 30, current),
  } as const;

  const sma_dist = {
    '20': calcSmaDist(dayCloses, 20, current),
    '50': calcSmaDist(dayCloses, 50, current),
    '200': calcSmaDist(dayCloses, 200, current),
  } as const;

  const macd_hist = calcMacdHist(dayCloses);

  const vol = {
    rv_7d: realizedVol(dayCloses, 7),
    rv_30d: realizedVol(dayCloses, 30),
    atr_pct: (calcAtr(dayHighs, dayLows, dayCloses) / current) * 100,
  } as const;

  const range = {
    bb_bw: bollingerBandwidth(dayCloses, 20),
    donchian20: donchian(dayHighs, dayLows, current, 20),
  } as const;

  const volume = {
    z_1h: volumeZ(hourVolumes, 24),
    z_24h: volumeZ(dayVolumes, 30),
  } as const;

  const btc = await fetchPairData('BTC', 'USDT');
  const btcCloses = btc.year.map((k: any) => Number(k[4]));
  const corr = {
    BTC_30d: correlation(
      dailyReturns(dayCloses, 30),
      dailyReturns(btcCloses, 30),
    ),
  } as const;

  const regime = {
    BTC: bollingerBandwidth(btcCloses, 20) < 10 ? 'range' : 'trend',
  } as const;

  return { ret, sma_dist, macd_hist, vol, range, volume, corr, regime };
}

export type TokenIndicators = Awaited<ReturnType<typeof fetchTokenIndicators>>;

