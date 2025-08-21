import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');

vi.mock('../src/util/ai.js', () => ({
  callAi: vi.fn().mockResolvedValue('ok'),
}));

vi.mock('../src/util/crypto.js', () => ({
  decrypt: vi.fn().mockReturnValue('key'),
}));

migrate();

const reviewPortfolio = (await import('../src/jobs/review-portfolio.js')).default;
const { callAi } = await import('../src/util/ai.js');

describe('reviewPortfolio', () => {
  it('passes last five responses to callAi', async () => {
    db.prepare('INSERT INTO users (id, ai_api_key_enc) VALUES (?, ?)').run('u1', 'enc');
    db.prepare(
      `INSERT INTO agents (id, user_id, model, status, created_at, name, token_a, token_b, target_allocation, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, 'gpt', 'active', 0, 'Agent', 'BTC', 'ETH', 60, 10, 20, 'low', '1h', 'inst')`
    ).run('a1', 'u1');
    for (let i = 0; i < 6; i++) {
      db.prepare('INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)').run(`id${i}`, 'a1', `resp-${i}`, i);
    }
    const log: any = { child: () => log, info: () => {}, error: () => {} };
    await reviewPortfolio(log, 'a1');
    expect(callAi).toHaveBeenCalledTimes(1);
    const args = (callAi as any).mock.calls[0];
    expect(args[3]).toEqual(['resp-5', 'resp-4', 'resp-3', 'resp-2', 'resp-1']);
  });
});
