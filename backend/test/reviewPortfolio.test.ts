import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { db } from '../src/db/index.js';

const sampleIndicators = {
  ret: { '1h': 0, '4h': 0, '24h': 0, '7d': 0, '30d': 0 },
  sma_dist: { '20': 0, '50': 0, '200': 0 },
  macd_hist: 0,
  vol: { rv_7d: 0, rv_30d: 0, atr_pct: 0 },
  range: { bb_bw: 0, donchian20: 0 },
  volume: { z_1h: 0, z_24h: 0 },
  corr: { BTC_30d: 0 },
  regime: { BTC: 'range' },
  osc: { rsi_14: 0, stoch_k: 0, stoch_d: 0 },
};

const sampleTimeseries = {
  minute_60: [[1, 2, 3, 4]],
  hourly_24h: [[5, 6, 7, 8]],
  monthly_24m: [[9, 10, 11]],
};

const flatIndicators = {
  ret_1h: 0,
  ret_4h: 0,
  ret_24h: 0,
  ret_7d: 0,
  ret_30d: 0,
  sma_dist_20: 0,
  sma_dist_50: 0,
  sma_dist_200: 0,
  macd_hist: 0,
  vol_rv_7d: 0,
  vol_rv_30d: 0,
  vol_atr_pct: 0,
  range_bb_bw: 0,
  range_donchian20: 0,
  volume_z_1h: 0,
  volume_z_24h: 0,
  corr_BTC_30d: 0,
  regime_BTC: 'range',
  osc_rsi_14: 0,
  osc_stoch_k: 0,
  osc_stoch_d: 0,
};

const flatTimeseries = {
  ret_60m: ((3 - 2) / 2) * 100,
  ret_24h: ((7 - 6) / 6) * 100,
  ret_24m: ((11 - 10) / 10) * 100,
};

const runMainTrader = vi.fn();
vi.mock('../src/workflows/portfolio-review.js', () => ({ runMainTrader }));

const getCache = vi.fn();
vi.mock('../src/util/cache.js', () => ({ getCache }));

vi.mock('../src/util/crypto.js', () => ({
  decrypt: vi.fn().mockReturnValue('key'),
}));

vi.mock('../src/services/binance.js', () => ({
  fetchAccount: vi.fn().mockResolvedValue({
    balances: [
      { asset: 'BTC', free: '1', locked: '0.5' },
      { asset: 'ETH', free: '2', locked: '0' },
    ],
  }),
  fetchPairData: vi.fn().mockResolvedValue({ currentPrice: 100 }),
  fetchMarketTimeseries: vi.fn().mockResolvedValue(sampleTimeseries),
  fetchPairInfo: vi.fn().mockResolvedValue({
    symbol: 'BTCETH',
    baseAsset: 'BTC',
    quoteAsset: 'ETH',
    quantityPrecision: 8,
    pricePrecision: 8,
    minNotional: 0,
  }),
  cancelOrder: vi.fn().mockResolvedValue(undefined),
  parseBinanceError: vi.fn().mockReturnValue(null),
  fetchFearGreedIndex: vi
    .fn()
    .mockResolvedValue({ value: 50, classification: 'Neutral' }),
}));

vi.mock('../src/services/indicators.js', () => ({
  fetchTokenIndicators: vi.fn().mockResolvedValue(sampleIndicators),
}));

const createRebalanceLimitOrder = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/services/rebalance.js', () => ({
  createRebalanceLimitOrder,
}));

vi.mock('../src/services/news-analyst.js', () => ({
  getTokenNewsSummary: vi.fn().mockResolvedValue({
    analysis: { comment: 'news', score: 1 },
    prompt: {},
    response: 'r',
  }),
}));

vi.mock('../src/services/technical-analyst.js', () => ({
  getTechnicalOutlook: vi.fn().mockResolvedValue({
    analysis: { comment: 'tech', score: 2 },
    prompt: {},
    response: 'r',
  }),
}));

vi.mock('../src/services/order-book-analyst.js', () => ({
  getOrderBookAnalysis: vi.fn().mockResolvedValue({
    analysis: { comment: 'order', score: 3 },
    prompt: {},
    response: 'r',
  }),
}));

vi.mock('../src/services/performance-analyst.js', () => ({
  getPerformanceAnalysis: vi.fn().mockResolvedValue({
    analysis: { comment: 'perf', score: 4 },
    prompt: {},
    response: 'r',
  }),
}));

let reviewAgentPortfolio: (log: FastifyBaseLogger, agentId: string) => Promise<void>;

beforeAll(async () => {
  ({ reviewAgentPortfolio } = await import('../src/workflows/portfolio-review.js'));
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function setupAgent(id: string, manual = false) {
  await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
  await db.query(
    "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
    [id, 'enc'],
  );
  await db.query(
    "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent', 'low', '1h', 'inst', $3)",
    [id, id, manual],
  );
  await db.query(
    "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
    [id],
  );
}

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('reviewPortfolio', () => {
  it('saves decision and logs', async () => {
    await setupAgent('1');
    const decision = { rebalance: false, newAllocation: 40, shortReport: 'ok' };
    getCache.mockResolvedValue(decision);
    const log = createLogger();
    await reviewAgentPortfolio(log, '1');
    expect(runMainTrader).toHaveBeenCalledTimes(1);
    const runId = runMainTrader.mock.calls[0][6];
    expect(getCache).toHaveBeenCalledWith(`portfolio:gpt:1:${runId}`);
    const { rows } = await db.query(
      'SELECT prompt, response FROM agent_review_raw_log WHERE agent_id=$1',
      ['1'],
    );
    const row = rows[0] as { prompt: string; response: string };
    expect(JSON.parse(row.response)).toEqual(decision);
    const { rows: resRows } = await db.query(
      'SELECT rebalance, new_allocation, short_report FROM agent_review_result WHERE agent_id=$1',
      ['1'],
    );
    const res = resRows[0] as { rebalance: boolean; new_allocation: number; short_report: string };
    expect(res.new_allocation).toBe(40);
    expect(res.rebalance).toBe(false);
  });

  it('calls createRebalanceLimitOrder when rebalance requested', async () => {
    await setupAgent('2');
    const decision = { rebalance: true, newAllocation: 60, shortReport: 's' };
    getCache.mockResolvedValue(decision);
    const log = createLogger();
    await reviewAgentPortfolio(log, '2');
    expect(createRebalanceLimitOrder).toHaveBeenCalledTimes(1);
    const args = createRebalanceLimitOrder.mock.calls[0][0];
    expect(args.userId).toBe('2');
    expect(args.newAllocation).toBe(60);
  });

  it('skips createRebalanceLimitOrder when manualRebalance is enabled', async () => {
    await setupAgent('3', true);
    const decision = { rebalance: true, newAllocation: 55, shortReport: 's' };
    getCache.mockResolvedValue(decision);
    const log = createLogger();
    await reviewAgentPortfolio(log, '3');
    expect(createRebalanceLimitOrder).not.toHaveBeenCalled();
  });

  it('records error when newAllocation is out of range', async () => {
    await setupAgent('4');
    const decision = { rebalance: true, newAllocation: 150, shortReport: 's' };
    getCache.mockResolvedValue(decision);
    const log = createLogger();
    await reviewAgentPortfolio(log, '4');
    const { rows } = await db.query(
      'SELECT new_allocation, error FROM agent_review_result WHERE agent_id=$1',
      ['4'],
    );
    const row = rows[0] as { new_allocation: number | null; error: string | null };
    expect(row.new_allocation).toBeNull();
    expect(row.error).not.toBeNull();
  });

  it('records error when newAllocation violates floor', async () => {
    await setupAgent('5');
    const decision = { rebalance: true, newAllocation: 5, shortReport: 's' };
    getCache.mockResolvedValue(decision);
    const log = createLogger();
    await reviewAgentPortfolio(log, '5');
    const { rows } = await db.query(
      'SELECT new_allocation, error FROM agent_review_result WHERE agent_id=$1',
      ['5'],
    );
    const row = rows[0] as { new_allocation: number | null; error: string | null };
    expect(row.new_allocation).toBeNull();
    expect(row.error).not.toBeNull();
  });
});

