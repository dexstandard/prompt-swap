import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { db } from '../src/db/index.js';

vi.mock('../src/util/ai.js', () => ({
  callAi: vi.fn().mockResolvedValue('ok'),
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
}));

let reviewPortfolio: (log: FastifyBaseLogger, agentId: string) => Promise<void>;
let callAi: any;
let fetchAccount: any;
let fetchPairData: any;

beforeAll(async () => {
  reviewPortfolio = (await import('../src/jobs/review-portfolio.js')).default;
  ({ callAi } = await import('../src/util/ai.js'));
  ({ fetchAccount, fetchPairData } = await import('../src/services/binance.js'));
});

describe('reviewPortfolio', () => {
  it('passes last five responses to callAi', async () => {
    db.prepare('INSERT INTO users (id, ai_api_key_enc) VALUES (?, ?)').run('u1', 'enc');
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'Agent', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
    ).run('a1', 'u1');
    for (let i = 0; i < 6; i++) {
      db
        .prepare(
          'INSERT INTO agent_exec_result (id, agent_id, log, rebalance, new_allocation, short_report, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          `id${i}`,
          'a1',
          'ignore',
          1,
          i,
          `short-${i}`,
          i,
        );
    }
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewPortfolio(log, 'a1');
    expect(callAi).toHaveBeenCalledTimes(1);
    const args = (callAi as any).mock.calls[0];
    const prev = args[3].map((s: string) => JSON.parse(s));
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
    expect(args[1].marketData).toEqual({ currentPrice: 100 });
  });

  it('saves prompt and response to exec log', async () => {
    vi.mocked(callAi).mockClear();
    vi.mocked(callAi).mockResolvedValueOnce('ok');
    db.prepare('INSERT INTO users (id, ai_api_key_enc) VALUES (?, ?)').run('u4', 'enc');
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'Agent4', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
    ).run('a4', 'u4');
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewPortfolio(log, 'a4');
    const rows = db
      .prepare('SELECT prompt, response FROM agent_exec_log WHERE agent_id = ?')
      .all('a4') as { prompt: string | null; response: string | null }[];
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].prompt!)).toMatchObject({
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
    const respEntry = JSON.parse(rows[0].response!);
    expect(typeof respEntry).toBe('string');

    const parsedRows = db
      .prepare(
        'SELECT log, rebalance, new_allocation, short_report, error FROM agent_exec_result WHERE agent_id = ?',
      )
      .all('a4') as {
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

  it('logs error when token balances missing and skips callAi', async () => {
    vi.mocked(callAi).mockClear();
    vi.mocked(fetchAccount).mockResolvedValueOnce({
      balances: [{ asset: 'BTC', free: '1', locked: '0' }],
    });
    db.prepare('INSERT INTO users (id, ai_api_key_enc) VALUES (?, ?)').run('u2', 'enc');
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'Agent2', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
    ).run('a2', 'u2');
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewPortfolio(log, 'a2');
    expect(callAi).not.toHaveBeenCalled();
    const rows = db
      .prepare('SELECT response FROM agent_exec_log WHERE agent_id = ?')
      .all('a2') as { response: string | null }[];
    expect(rows).toHaveLength(1);
    const entry = JSON.parse(rows[0].response!);
    expect(entry.error).toContain('failed to fetch token balances');
    const parsedRows = db
      .prepare(
        'SELECT log, error FROM agent_exec_result WHERE agent_id = ?',
      )
      .all('a2') as { log: string; error: string | null }[];
    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].error).toContain('failed to fetch token balances');
  });

  it('logs error when market data fetch fails and skips callAi', async () => {
    vi.mocked(callAi).mockClear();
    vi.mocked(fetchAccount).mockResolvedValueOnce({
      balances: [
        { asset: 'BTC', free: '1', locked: '0' },
        { asset: 'ETH', free: '2', locked: '0' },
      ],
    });
    vi.mocked(fetchPairData).mockRejectedValueOnce(new Error('fail'));
    db.prepare('INSERT INTO users (id, ai_api_key_enc) VALUES (?, ?)').run('u3', 'enc');
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'Agent3', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
    ).run('a3', 'u3');
    const log = { child: () => log, info: () => {}, error: () => {} } as unknown as FastifyBaseLogger;
    await reviewPortfolio(log, 'a3');
    expect(callAi).not.toHaveBeenCalled();
    const rows = db
      .prepare('SELECT response FROM agent_exec_log WHERE agent_id = ?')
      .all('a3') as { response: string | null }[];
    expect(rows).toHaveLength(1);
    const entry2 = JSON.parse(rows[0].response!);
    expect(entry2.error).toContain('failed to fetch market data');
    const parsedRows = db
      .prepare(
        'SELECT log, error FROM agent_exec_result WHERE agent_id = ?',
      )
      .all('a3') as { log: string; error: string | null }[];
    expect(parsedRows).toHaveLength(1);
    expect(parsedRows[0].error).toContain('failed to fetch market data');
  });
});
