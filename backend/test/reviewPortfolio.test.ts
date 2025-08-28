import { describe, it, expect, vi, beforeAll } from 'vitest';
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
};

const sampleTimeseries = {
  minute_60: [[1, 2, 3, 4]],
  hourly_24h: [[5, 6, 7, 8]],
  monthly_24m: [[9, 10, 11]],
};

vi.mock('../src/util/ai.js', () => ({
  callRebalancingAgent: vi.fn().mockResolvedValue('ok'),
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
}));

vi.mock('../src/services/indicators.js', () => ({
  fetchTokenIndicators: vi.fn().mockResolvedValue(sampleIndicators),
}));

vi.mock('../src/services/rebalance.js', () => ({
  createRebalanceLimitOrder: vi.fn().mockResolvedValue(undefined),
}));

let reviewAgentPortfolio: (log: FastifyBaseLogger, agentId: string) => Promise<void>;
let reviewPortfolios: (
  log: FastifyBaseLogger,
  interval: string,
) => Promise<void>;
let callRebalancingAgent: any;
let fetchAccount: any;
let fetchPairData: any;
let fetchMarketTimeseries: any;
let fetchTokenIndicators: any;
let createRebalanceLimitOrder: any;

beforeAll(async () => {
  ({ reviewAgentPortfolio, default: reviewPortfolios } = await import(
    '../src/jobs/review-portfolio.js'
  ));
  ({ callRebalancingAgent } = await import('../src/util/ai.js'));
  ({ fetchAccount, fetchPairData, fetchMarketTimeseries } = await import(
    '../src/services/binance.js'
  ));
  ({ fetchTokenIndicators } = await import('../src/services/indicators.js'));
  ({ createRebalanceLimitOrder } = await import('../src/services/rebalance.js'));
});

describe('reviewPortfolio', () => {
  it('passes last five responses to callRebalancingAgent', async () => {
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '1',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['1', '1'],
    );
    for (let i = 0; i < 6; i++) {
      await db.query(
        'INSERT INTO agent_exec_result (agent_id, log, rebalance, new_allocation, short_report, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        ['1', 'ignore', 1, i, `short-${i}`, i],
      );
    }
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '1');
    expect(callRebalancingAgent).toHaveBeenCalledTimes(1);
    const args = (callRebalancingAgent as any).mock.calls[0];
    const prev = args[1].previous_responses.map((s: string) => JSON.parse(s));
    expect(prev).toEqual([
      { rebalance: true, newAllocation: 5, shortReport: 'short-5' },
      { rebalance: true, newAllocation: 4, shortReport: 'short-4' },
      { rebalance: true, newAllocation: 3, shortReport: 'short-3' },
      { rebalance: true, newAllocation: 2, shortReport: 'short-2' },
      { rebalance: true, newAllocation: 1, shortReport: 'short-1' },
    ]);
    const cfg = args[1].config;
    const btcPos = cfg.portfolio.positions.find((p: any) => p.sym === 'BTC');
    const ethPos = cfg.portfolio.positions.find((p: any) => p.sym === 'ETH');
    expect(btcPos.qty).toBe(1.5);
    expect(ethPos.qty).toBe(2);
    expect(cfg.policy.floors).toEqual({ BTC: 0.1, ETH: 0.2 });
    expect(cfg.portfolio.weights.BTC).toBeCloseTo(150 / 350);
    expect(cfg.portfolio.weights.ETH).toBeCloseTo(200 / 350);
    expect(args[1].marketData).toEqual({
      currentPrice: 100,
      indicators: { BTC: sampleIndicators, ETH: sampleIndicators },
      market_timeseries: {
        BTCUSDT: sampleTimeseries,
        ETHUSDT: sampleTimeseries,
      },
    });
    expect(fetchTokenIndicators).toHaveBeenCalledTimes(2);
    expect(fetchMarketTimeseries).toHaveBeenCalledTimes(2);
  });

  it('saves prompt and response to exec log', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    vi.mocked(callRebalancingAgent).mockResolvedValueOnce('ok');
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '4',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent4', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['4', '4'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '4');
    const { rows } = await db.query(
      'SELECT prompt, response FROM agent_exec_log WHERE agent_id = $1',
      ['4'],
    );
    const rowsTyped = rows as { prompt: string | null; response: string | null }[];
    expect(rowsTyped).toHaveLength(1);
    expect(JSON.parse(rowsTyped[0].prompt!)).toMatchObject({
      instructions: 'inst',
      config: {
        policy: { floors: { BTC: 0.1, ETH: 0.2 } },
        portfolio: {
          positions: [
            expect.objectContaining({ sym: 'BTC', qty: 1.5 }),
            expect.objectContaining({ sym: 'ETH', qty: 2 }),
          ],
        },
      },
    });
    const respEntry = JSON.parse(rowsTyped[0].response!);
    expect(typeof respEntry).toBe('string');

    const { rows: parsedRowsRaw } = await db.query(
      'SELECT log, rebalance, new_allocation, short_report, error FROM agent_exec_result WHERE agent_id = $1',
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
    expect(parsedRows[0].rebalance).toBeNull();
    expect(parsedRows[0].error).toBeNull();
  });

  it('calls createRebalanceLimitOrder when rebalance is requested', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    vi.mocked(createRebalanceLimitOrder).mockClear();
    vi.mocked(callRebalancingAgent).mockResolvedValueOnce(
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
    await db.query('DELETE FROM agents');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM agent_exec_log');
    await db.query('DELETE FROM agent_exec_result');
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '11',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent11', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['11', '11'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '11');
    expect(createRebalanceLimitOrder).toHaveBeenCalledTimes(1);
    const args = vi.mocked(createRebalanceLimitOrder).mock.calls[0][0];
    expect(args.userId).toBe('11');
    expect(args.tokenA).toBe('BTC');
    expect(args.tokenB).toBe('ETH');
    expect(args.newAllocation).toBe(60);
    expect(args.execResultId).toBeTruthy();
  });

  it('skips createRebalanceLimitOrder when manualRebalance is enabled', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    vi.mocked(createRebalanceLimitOrder).mockClear();
    vi.mocked(callRebalancingAgent).mockResolvedValueOnce(
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
    await db.query('DELETE FROM agents');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM agent_exec_log');
    await db.query('DELETE FROM agent_exec_result');
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '12',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions, manual_rebalance)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent12', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst', 1)`,
      ['12', '12'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '12');
    expect(createRebalanceLimitOrder).not.toHaveBeenCalled();
  });

  it('omits indicators for stablecoins', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    vi.mocked(fetchTokenIndicators).mockClear();
    vi.mocked(fetchMarketTimeseries).mockClear();
    vi.mocked(fetchAccount).mockResolvedValueOnce({
      balances: [
        { asset: 'USDT', free: '1', locked: '0' },
        { asset: 'ETH', free: '2', locked: '0' },
      ],
    });
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '5',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent5', 'USDT', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['5', '5'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '5');
    expect(callRebalancingAgent).toHaveBeenCalledTimes(1);
    const args = (callRebalancingAgent as any).mock.calls[0];
    expect(args[1].marketData).toEqual({
      currentPrice: 100,
      indicators: { ETH: sampleIndicators },
      market_timeseries: { ETHUSDT: sampleTimeseries },
    });
    expect(fetchTokenIndicators).toHaveBeenCalledTimes(1);
    expect(fetchTokenIndicators).toHaveBeenCalledWith('ETH');
    expect(fetchMarketTimeseries).toHaveBeenCalledTimes(1);
    expect(fetchMarketTimeseries).toHaveBeenCalledWith('ETHUSDT');
  });

  it('logs error when token balances missing and skips callRebalancingAgent', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    vi.mocked(fetchAccount).mockResolvedValueOnce({
      balances: [{ asset: 'BTC', free: '1', locked: '0' }],
    });
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '2',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent2', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['2', '2'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '2');
    expect(callRebalancingAgent).not.toHaveBeenCalled();
    const { rows } = await db.query(
      'SELECT response FROM agent_exec_log WHERE agent_id = $1',
      ['2'],
    );
    const rowsTyped = rows as { response: string | null }[];
    expect(rowsTyped).toHaveLength(1);
    const entry = JSON.parse(rowsTyped[0].response!);
    expect(entry.error).toContain('failed to fetch token balances');
    const { rows: parsedRowsRaw } = await db.query(
      'SELECT log, error FROM agent_exec_result WHERE agent_id = $1',
      ['2'],
    );
    const parsedRows = parsedRowsRaw as { log: string; error: string | null }[];
    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].error).toContain('failed to fetch token balances');
  });

  it('logs error when market data fetch fails and skips callRebalancingAgent', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    vi.mocked(fetchAccount).mockResolvedValueOnce({
      balances: [
        { asset: 'BTC', free: '1', locked: '0' },
        { asset: 'ETH', free: '2', locked: '0' },
      ],
    });
    vi.mocked(fetchPairData).mockRejectedValueOnce(new Error('fail'));
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '3',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent3', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['3', '3'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewAgentPortfolio(log, '3');
    expect(callRebalancingAgent).not.toHaveBeenCalled();
    const { rows } = await db.query(
      'SELECT response FROM agent_exec_log WHERE agent_id = $1',
      ['3'],
    );
    const rowsTyped = rows as { response: string | null }[];
    expect(rowsTyped).toHaveLength(1);
    const entry2 = JSON.parse(rowsTyped[0].response!);
    expect(entry2.error).toContain('failed to fetch market data');
    const { rows: parsedRowsRaw } = await db.query(
      'SELECT log, error FROM agent_exec_result WHERE agent_id = $1',
      ['3'],
    );
    const parsedRows = parsedRowsRaw as { log: string; error: string | null }[];
    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].error).toContain('failed to fetch market data');
  });

  it('fetches market data once for agents sharing tokens', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    vi.mocked(fetchPairData).mockClear();
    vi.mocked(fetchTokenIndicators).mockClear();
    vi.mocked(fetchMarketTimeseries).mockClear();
    await db.query('DELETE FROM agents');
    await db.query('DELETE FROM users');
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '6',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent6', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['6', '6'],
    );
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent7', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['7', '6'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewPortfolios(log, '1h'); // run for all 1h agents
    expect(fetchPairData).toHaveBeenCalledTimes(3);
    expect(fetchTokenIndicators).toHaveBeenCalledTimes(2);
    expect(fetchMarketTimeseries).toHaveBeenCalledTimes(2);
    expect(callRebalancingAgent).toHaveBeenCalledTimes(2);
  });

  it('runs only agents matching interval', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    await db.query('DELETE FROM agents');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM agent_exec_log');
    await db.query('DELETE FROM agent_exec_result');
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '8',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent9', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['9', '8'],
    );
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent10', 'BTC', 'ETH', 10, 20, 'low', '3h', 'inst')`,
      ['10', '8'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewPortfolios(log, '3h');
    expect(callRebalancingAgent).toHaveBeenCalledTimes(1);
    const { rows } = await db.query('SELECT agent_id FROM agent_exec_log');
    const rowsTyped = rows as { agent_id: string }[];
    expect(rowsTyped).toHaveLength(1);
    expect(rowsTyped[0].agent_id).toBe('10');
  });

  it('prevents concurrent runs for same agent', async () => {
    vi.mocked(callRebalancingAgent).mockClear();
    await db.query('DELETE FROM agents');
    await db.query('DELETE FROM users');
    let resolveFn!: (v: unknown) => void;
    vi.mocked(callRebalancingAgent).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    await db.query('INSERT INTO users (id, ai_api_key_enc) VALUES ($1, $2)', [
      '7',
      'enc',
    ]);
    await db.query(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES ($1, $2, 'gpt', 'active', 0, 'Agent8', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`,
      ['8', '7'],
    );
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    const p1 = reviewAgentPortfolio(log, '8');
    await new Promise((r) => setImmediate(r));
    await expect(reviewAgentPortfolio(log, '8')).rejects.toThrow(
      'Agent is already reviewing portfolio',
    );
    resolveFn('ok');
    await p1;
    expect(callRebalancingAgent).toHaveBeenCalledTimes(1);
  });
});
