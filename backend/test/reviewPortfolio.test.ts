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

vi.mock('../src/util/ai.js', () => ({
  callTraderAgent: vi.fn().mockResolvedValue('ok'),
}));

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

vi.mock('../src/services/rebalance.js', () => ({
  createRebalanceLimitOrder: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/news-analyst.js', () => ({
  getTokenNewsSummary: vi
    .fn()
    .mockImplementation(
      (
        token: string,
        _model?: string,
        _apiKey?: string,
        _log?: FastifyBaseLogger,
      ) =>
        Promise.resolve({
          analysis: { comment: `${token} news`, score: 1 },
          prompt: { token },
          response: 'r',
        }),
    ),
}));
vi.mock('../src/services/technical-analyst.js', () => ({
  getTechnicalOutlook: vi.fn().mockImplementation(
    (
      token: string,
      _model?: string,
      _apiKey?: string,
      _timeframe?: string,
      _log?: FastifyBaseLogger,
    ) =>
      Promise.resolve({
        analysis: { comment: `${token} tech`, score: 2 },
        prompt: { token },
        response: 'r',
      }),
  ),
}));
vi.mock('../src/services/order-book-analyst.js', () => ({
  getOrderBookAnalysis: vi.fn().mockImplementation(
    (
      pair: string,
      _model?: string,
      _apiKey?: string,
      _log?: FastifyBaseLogger,
    ) =>
      Promise.resolve({
        analysis: { comment: `${pair} order`, score: 3 },
        prompt: { pair },
        response: 'r',
      }),
  ),
}));
vi.mock('../src/services/performance-analyst.js', () => ({
  getPerformanceAnalysis: vi.fn().mockResolvedValue({
    analysis: { comment: 'perf', score: 4 },
    prompt: {},
    response: 'r',
  }),
}));

let reviewAgentPortfolio: (log: FastifyBaseLogger, agentId: string) => Promise<void>;
let reviewPortfolios: (
  log: FastifyBaseLogger,
  interval: string,
) => Promise<void>;
let callTraderAgent: any;
let fetchAccount: any;
let fetchPairData: any;
let fetchMarketTimeseries: any;
let fetchPairInfo: any;
let fetchTokenIndicators: any;
let createRebalanceLimitOrder: any;
let fetchFearGreedIndex: any;
let getTokenNewsSummary: any;
let getTechnicalOutlook: any;
let getOrderBookAnalysis: any;
let getPerformanceAnalysis: any;

beforeAll(async () => {
  ({ reviewAgentPortfolio, default: reviewPortfolios } = await import(
    '../src/jobs/review-portfolio.js'
  ));
  ({ callTraderAgent } = await import('../src/util/ai.js'));
  ({
    fetchAccount,
    fetchPairData,
    fetchMarketTimeseries,
    fetchPairInfo,
    fetchFearGreedIndex,
  } = await import('../src/services/binance.js'));
  ({ fetchTokenIndicators } = await import('../src/services/indicators.js'));
  ({ createRebalanceLimitOrder } = await import('../src/services/rebalance.js'));
  ({ getTokenNewsSummary } = await import('../src/services/news-analyst.js'));
  ({ getTechnicalOutlook } = await import('../src/services/technical-analyst.js'));
  ({ getOrderBookAnalysis } = await import('../src/services/order-book-analyst.js'));
  ({ getPerformanceAnalysis } = await import('../src/services/performance-analyst.js'));
});

beforeEach(() => {
  vi.mocked(callTraderAgent).mockClear();
  vi.mocked(fetchAccount).mockClear();
  vi.mocked(fetchPairData).mockClear();
  vi.mocked(fetchMarketTimeseries).mockClear();
  vi.mocked(fetchPairInfo).mockClear();
  vi.mocked(fetchTokenIndicators).mockClear();
  vi.mocked(createRebalanceLimitOrder).mockClear();
  vi.mocked(fetchFearGreedIndex).mockClear();
  vi.mocked(getTokenNewsSummary).mockClear();
  vi.mocked(getTechnicalOutlook).mockClear();
  vi.mocked(getOrderBookAnalysis).mockClear();
  vi.mocked(getPerformanceAnalysis).mockClear();
});

describe('reviewPortfolio', () => {
  it('passes last five responses to callTraderAgent', async () => {
    vi.mocked(fetchFearGreedIndex).mockClear();
    await db.query('INSERT INTO users (id) VALUES ($1)', ['1']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['1', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent', 'low', '1h', 'inst', false)",
      ['1', '1'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['1'],
    );
    const base = new Date('2023-01-01T00:00:00Z');
    for (let i = 0; i < 6; i++) {
      await db.query(
        'INSERT INTO agent_review_result (agent_id, log, rebalance, new_allocation, short_report, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        ['1', 'ignore', 1, i, `short-${i}`, new Date(base.getTime() + i * 1000)],
      );
    }
    const { rows: rrRows } = await db.query(
      'SELECT id FROM agent_review_result WHERE agent_id = $1 ORDER BY created_at ASC',
      ['1'],
    );
    for (let i = 0; i < 5; i++) {
      await db.query(
        'INSERT INTO limit_order (user_id, planned_json, status, review_result_id, order_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          '1',
          JSON.stringify({ symbol: 'BTCETH', side: 'BUY', quantity: i }),
          'open',
          rrRows[i].id,
          `ord-${i}`,
          new Date(base.getTime() + i * 1000),
        ],
      );
    }
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '1');
    expect(callTraderAgent).toHaveBeenCalledTimes(1);
    const args = (callTraderAgent as any).mock.calls[0];
    const prev = args[1].previous_responses;
    expect(prev).toEqual([
      { rebalance: true, newAllocation: 5, shortReport: 'short-5' },
      { rebalance: true, newAllocation: 4, shortReport: 'short-4' },
      { rebalance: true, newAllocation: 3, shortReport: 'short-3' },
      { rebalance: true, newAllocation: 2, shortReport: 'short-2' },
      { rebalance: true, newAllocation: 1, shortReport: 'short-1' },
    ]);
    const portfolio = args[1].portfolio;
    const policy = args[1].policy;
    const prevOrders = args[1].prev_orders;
    const btcPos = portfolio.positions.find((p: any) => p.sym === 'BTC');
    const ethPos = portfolio.positions.find((p: any) => p.sym === 'ETH');
    expect(btcPos.qty).toBe(1.5);
    expect(ethPos.qty).toBe(2);
    expect(policy.floor).toEqual({ BTC: 10, ETH: 20 });
    const total = portfolio.positions.reduce(
      (sum: number, p: any) => sum + p.value_usdt,
      0,
    );
    expect(btcPos.value_usdt / total).toBeCloseTo(150 / 350);
    expect(ethPos.value_usdt / total).toBeCloseTo(200 / 350);
    expect(prevOrders[0]).toMatchObject({
      symbol: 'BTCETH',
      side: 'BUY',
      status: 'canceled',
    });
    expect(prevOrders.map((o: any) => o.amount)).toEqual([
      4,
      3,
      2,
      1,
      0,
    ]);
    expect(args[1].marketData).toEqual({
      currentPrice: 100,
      fearGreedIndex: { value: 50, classification: 'Neutral' },
      indicators: { BTC: flatIndicators, ETH: flatIndicators },
      market_timeseries: { BTCUSDT: flatTimeseries, ETHUSDT: flatTimeseries },
      newsReports: { BTC: 'BTC news', ETH: 'ETH news' },
    });
    expect(JSON.stringify(args[1].marketData)).not.toContain('minute_60');
    expect(fetchTokenIndicators).toHaveBeenCalledTimes(2);
    expect(fetchMarketTimeseries).toHaveBeenCalledTimes(2);
    expect(fetchFearGreedIndex).toHaveBeenCalledTimes(1);
    expect(args[1].reports).toEqual([
      {
        token: 'BTC',
        news: { comment: 'BTC news', score: 1 },
        tech: { comment: 'BTC tech', score: 2 },
        orderbook: { comment: 'BTCUSDT order', score: 3 },
      },
      {
        token: 'ETH',
        news: { comment: 'ETH news', score: 1 },
        tech: { comment: 'ETH tech', score: 2 },
        orderbook: { comment: 'ETHUSDT order', score: 3 },
      },
    ]);
    expect(args[1].performance).toEqual({ comment: 'perf', score: 4 });
  });

  it('saves prompt and response to exec log', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(callTraderAgent).mockResolvedValueOnce('ok');
    await db.query('INSERT INTO users (id) VALUES ($1)', ['4']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['4', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent4', 'low', '1h', 'inst', false)",
      ['4', '4'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['4'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '4');
    const { rows } = await db.query(
      'SELECT prompt, response FROM agent_review_raw_log WHERE agent_id = $1',
      ['4'],
    );
    const rowsTyped = rows as { prompt: string | null; response: string | null }[];
    expect(rowsTyped).toHaveLength(1);
    expect(JSON.parse(rowsTyped[0].prompt!)).toMatchObject({
      instructions: 'inst',
      policy: { floor: { BTC: 10, ETH: 20 } },
      portfolio: {
        positions: [
          expect.objectContaining({ sym: 'BTC', qty: 1.5 }),
          expect.objectContaining({ sym: 'ETH', qty: 2 }),
        ],
      },
    });
    const respEntry = JSON.parse(rowsTyped[0].response!);
    expect(typeof respEntry).toBe('string');

    const { rows: parsedRowsRaw } = await db.query(
      'SELECT log, rebalance, new_allocation, short_report, error FROM agent_review_result WHERE agent_id = $1',
      ['4'],
    );
    const parsedRows = parsedRowsRaw as {
      log: string;
      rebalance: number | null;
      new_allocation: number | null;
      short_report: string | null;
      error: string | null;
    }[];
    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].log).toBe('ok');
    expect(parsedRows[0].rebalance).toBe(false);
    expect(parsedRows[0].error).toBeNull();
  });

  it('calls createRebalanceLimitOrder when rebalance is requested', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(createRebalanceLimitOrder).mockClear();
    vi.mocked(callTraderAgent).mockResolvedValueOnce(
      JSON.stringify({
        object: 'response',
        output: [
          {
            id: 'msg_1',
            content: [
              {
                text: JSON.stringify({
                  result: { rebalance: true, newAllocation: 60, shortReport: 's' },
                }),
              },
            ],
          },
        ],
      }),
    );
    await db.query('INSERT INTO users (id) VALUES ($1)', ['11']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['11', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent11', 'low', '1h', 'inst', false)",
      ['11', '11'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['11'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '11');
    expect(createRebalanceLimitOrder).toHaveBeenCalledTimes(1);
    const args = vi.mocked(createRebalanceLimitOrder).mock.calls[0][0];
    expect(args.userId).toBe('11');
    expect(args.tokens).toEqual(['BTC', 'ETH']);
    expect(args.newAllocation).toBe(60);
    expect(args.reviewResultId).toBeTruthy();
  });

  it('skips createRebalanceLimitOrder when manualRebalance is enabled', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(createRebalanceLimitOrder).mockClear();
    vi.mocked(callTraderAgent).mockResolvedValueOnce(
      JSON.stringify({
        object: 'response',
        output: [
          {
            id: 'msg_1',
            content: [
              {
                text: JSON.stringify({
                  result: { rebalance: true, newAllocation: 55, shortReport: 's' },
                }),
              },
            ],
          },
        ],
      }),
    );
    await db.query('INSERT INTO users (id) VALUES ($1)', ['12']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['12', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent12', 'low', '1h', 'inst', TRUE)",
      ['12', '12'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['12'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '12');
    expect(createRebalanceLimitOrder).not.toHaveBeenCalled();
  });

  it('records error when newAllocation is out of range', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(createRebalanceLimitOrder).mockClear();
    vi.mocked(callTraderAgent).mockResolvedValueOnce(
      JSON.stringify({
        object: 'response',
        output: [
          {
            id: 'msg_1',
            content: [
              {
                text: JSON.stringify({
                  result: { rebalance: true, newAllocation: 150, shortReport: 's' },
                }),
              },
            ],
          },
        ],
      }),
    );
    await db.query('INSERT INTO users (id) VALUES ($1)', ['13']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['13', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent13', 'low', '1h', 'inst', false)",
      ['13', '13'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['13'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '13');
    expect(createRebalanceLimitOrder).not.toHaveBeenCalled();
    const { rows } = await db.query(
      'SELECT new_allocation, error FROM agent_review_result WHERE agent_id=$1',
      ['13'],
    );
    const typed = rows as { new_allocation: number | null; error: string | null }[];
    expect(typed[0].new_allocation).toBeNull();
    expect(typed[0].error).not.toBeNull();
  });

  it('records error when newAllocation violates floor', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(createRebalanceLimitOrder).mockClear();
    vi.mocked(callTraderAgent).mockResolvedValueOnce(
      JSON.stringify({
        object: 'response',
        output: [
          {
            id: 'msg_1',
            content: [
              {
                text: JSON.stringify({
                  result: { rebalance: true, newAllocation: 5, shortReport: 's' },
                }),
              },
            ],
          },
        ],
      }),
    );
    await db.query('INSERT INTO users (id) VALUES ($1)', ['14']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['14', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent14', 'low', '1h', 'inst', false)",
      ['14', '14'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['14'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '14');
    expect(createRebalanceLimitOrder).not.toHaveBeenCalled();
    const { rows } = await db.query(
      'SELECT new_allocation, error FROM agent_review_result WHERE agent_id=$1',
      ['14'],
    );
    const typed = rows as { new_allocation: number | null; error: string | null }[];
    expect(typed[0].new_allocation).toBeNull();
    expect(typed[0].error).not.toBeNull();
  });

  it('omits indicators for stablecoins', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(fetchTokenIndicators).mockClear();
    vi.mocked(fetchMarketTimeseries).mockClear();
    vi.mocked(fetchAccount).mockResolvedValueOnce({
      balances: [
        { asset: 'USDT', free: '1', locked: '0' },
        { asset: 'ETH', free: '2', locked: '0' },
      ],
    });
    await db.query('INSERT INTO users (id) VALUES ($1)', ['5']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['5', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent5', 'low', '1h', 'inst', false)",
      ['5', '5'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'USDT', 10, 1), ($1, 'ETH', 20, 2)",
      ['5'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '5');
    expect(callTraderAgent).toHaveBeenCalledTimes(1);
    const args = (callTraderAgent as any).mock.calls[0];
    expect(args[1].marketData).toEqual({
      currentPrice: 100,
      fearGreedIndex: { value: 50, classification: 'Neutral' },
      indicators: { ETH: flatIndicators },
      market_timeseries: { ETHUSDT: flatTimeseries },
      newsReports: { USDT: 'USDT news', ETH: 'ETH news' },
    });
    expect(JSON.stringify(args[1].marketData)).not.toContain('minute_60');
    expect(fetchTokenIndicators).toHaveBeenCalledTimes(1);
    expect(fetchTokenIndicators).toHaveBeenCalledWith('ETH');
    expect(fetchMarketTimeseries).toHaveBeenCalledTimes(1);
    expect(fetchMarketTimeseries).toHaveBeenCalledWith('ETHUSDT');
  });

  it('continues when news summary fails', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(getTokenNewsSummary).mockClear();
    vi.mocked(getTokenNewsSummary)
      .mockImplementationOnce(() => Promise.reject(new Error('fail')))
      .mockImplementationOnce((token: string) =>
        Promise.resolve({
          analysis: { comment: `${token} news`, score: 1 },
          prompt: { token },
          response: 'r',
        }),
      );
    await db.query('INSERT INTO users (id) VALUES ($1)', ['9']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['9', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent9', 'low', '1h', 'inst', false)",
      ['9', '9'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['9'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '9');
    expect(callTraderAgent).toHaveBeenCalledTimes(1);
    const args = (callTraderAgent as any).mock.calls[0];
    const reports = args[1].reports;
    expect(reports).toHaveLength(2);
    const btc = reports.find((r: any) => r.token === 'BTC');
    const eth = reports.find((r: any) => r.token === 'ETH');
    expect(btc?.news?.comment).toContain('Error: fail');
    expect(eth?.news?.comment).toBe('ETH news');
  });

  it('logs error when token balances missing and skips callTraderAgent', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(fetchAccount).mockResolvedValueOnce({
      balances: [{ asset: 'BTC', free: '1', locked: '0' }],
    });
    await db.query('INSERT INTO users (id) VALUES ($1)', ['2']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['2', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent2', 'low', '1h', 'inst', false)",
      ['2', '2'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['2'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '2');
    expect(callTraderAgent).not.toHaveBeenCalled();
    const { rows } = await db.query(
      'SELECT response FROM agent_review_raw_log WHERE agent_id = $1',
      ['2'],
    );
    const rowsTyped = rows as { response: string | null }[];
    expect(rowsTyped).toHaveLength(0);
    const { rows: parsedRowsRaw } = await db.query(
      'SELECT log, error FROM agent_review_result WHERE agent_id = $1',
      ['2'],
    );
    const parsedRows = parsedRowsRaw as { log: string; error: string | null }[];
    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].error).toContain('failed to fetch token balances');
  });

  it('logs error when market data fetch fails and skips callTraderAgent', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(fetchAccount).mockResolvedValueOnce({
      balances: [
        { asset: 'BTC', free: '1', locked: '0' },
        { asset: 'ETH', free: '2', locked: '0' },
      ],
    });
    vi.mocked(fetchPairData).mockRejectedValueOnce(new Error('fail'));
    await db.query('INSERT INTO users (id) VALUES ($1)', ['3']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['3', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent3', 'low', '1h', 'inst', false)",
      ['3', '3'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['3'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '3');
    expect(callTraderAgent).not.toHaveBeenCalled();
    const { rows } = await db.query(
      'SELECT response FROM agent_review_raw_log WHERE agent_id = $1',
      ['3'],
    );
    const rowsTyped = rows as { response: string | null }[];
    expect(rowsTyped).toHaveLength(0);
    const { rows: parsedRowsRaw } = await db.query(
      'SELECT log, error FROM agent_review_result WHERE agent_id = $1',
      ['3'],
    );
    const parsedRows = parsedRowsRaw as { log: string; error: string | null }[];
    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].error).toContain('failed to fetch market data');
  });

  it('fetches market data once for agents sharing tokens', async () => {
    vi.mocked(callTraderAgent).mockClear();
    vi.mocked(fetchPairData).mockClear();
    vi.mocked(fetchTokenIndicators).mockClear();
    vi.mocked(fetchMarketTimeseries).mockClear();
    await db.query('INSERT INTO users (id) VALUES ($1)', ['6']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['6', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent6', 'low', '1h', 'inst', false)",
      ['6', '6'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['6'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent7', 'low', '1h', 'inst', false)",
      ['7', '6'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['7'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewPortfolios(log, '1h'); // run for all 1h agents
    expect(fetchPairData).toHaveBeenCalledTimes(3);
    expect(fetchTokenIndicators).toHaveBeenCalledTimes(2);
    expect(fetchMarketTimeseries).toHaveBeenCalledTimes(2);
    expect(callTraderAgent).toHaveBeenCalledTimes(2);
  });

  it('runs only agents matching interval', async () => {
    vi.mocked(callTraderAgent).mockClear();
    await db.query('INSERT INTO users (id) VALUES ($1)', ['8']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['8', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent9', 'low', '1h', 'inst', false)",
      ['9', '8'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['9'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent10', 'low', '3h', 'inst', false)",
      ['10', '8'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['10'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewPortfolios(log, '3h');
    expect(callTraderAgent).toHaveBeenCalledTimes(1);
    const { rows } = await db.query('SELECT agent_id FROM agent_review_raw_log');
    const rowsTyped = rows as { agent_id: string }[];
    expect(rowsTyped).toHaveLength(1);
    expect(rowsTyped[0].agent_id).toBe('10');
  });

  it.skip('prevents concurrent runs for same agent', async () => {
    vi.mocked(callTraderAgent).mockClear();
    let resolveFn!: (v: unknown) => void;
    vi.mocked(callTraderAgent).mockImplementation(
      () => new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );
    await db.query('INSERT INTO users (id) VALUES ($1)', ['7']);
    await db.query(
      "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2)",
      ['7', 'enc'],
    );
    await db.query(
      "INSERT INTO agents (id, user_id, model, status, name, risk, review_interval, agent_instructions, manual_rebalance) VALUES ($1, $2, 'gpt', 'active', 'Agent8', 'low', '1h', 'inst', false)",
      ['8', '7'],
    );
    await db.query(
      "INSERT INTO agent_tokens (agent_id, token, min_allocation, position) VALUES ($1, 'BTC', 10, 1), ($1, 'ETH', 20, 2)",
      ['8'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    const p1 = reviewAgentPortfolio(log, '8');
    await new Promise((r) => setImmediate(r));
    await expect(reviewAgentPortfolio(log, '8')).rejects.toThrow(
      'Agent is already reviewing portfolio',
    );
    resolveFn('ok');
    await p1;
    expect(callTraderAgent).toHaveBeenCalledTimes(1);
  });
});
