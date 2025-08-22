import { describe, it, expect, vi, beforeAll } from 'vitest';
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
}));

let reviewPortfolio: (log: unknown, agentId: string) => Promise<unknown>;
let callAi: any;
let fetchAccount: any;

beforeAll(async () => {
  reviewPortfolio = (await import('../src/jobs/review-portfolio.js')).default;
  ({ callAi } = await import('../src/util/ai.js'));
  ({ fetchAccount } = await import('../src/services/binance.js'));
});

describe('reviewPortfolio', () => {
  it('passes last five responses to callAi', async () => {
    db.prepare('INSERT INTO users (id, ai_api_key_enc) VALUES (?, ?)').run('u1', 'enc');
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'Agent', 'BTC', 'ETH', 10, 20, 'low', '1h', 'inst')`
    ).run('a1', 'u1');
    for (let i = 0; i < 6; i++) {
      db.prepare('INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)').run(`id${i}`, 'a1', `resp-${i}`, i);
    }
    const log: any = { child: () => log, info: () => {}, error: () => {} };
    await reviewPortfolio(log, 'a1');
    expect(callAi).toHaveBeenCalledTimes(1);
    const args = (callAi as any).mock.calls[0];
    expect(args[3]).toEqual(['resp-5', 'resp-4', 'resp-3', 'resp-2', 'resp-1']);
    expect(args[1].tokenABalance).toBe(1.5);
    expect(args[1].tokenBBalance).toBe(2);
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
    const log: any = { child: () => log, info: () => {}, error: () => {} };
    await reviewPortfolio(log, 'a2');
    expect(callAi).not.toHaveBeenCalled();
    const rows = db
      .prepare('SELECT log FROM agent_exec_log WHERE agent_id = ?')
      .all('a2') as { log: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].log).toContain('failed to fetch token balances');
  });
});
