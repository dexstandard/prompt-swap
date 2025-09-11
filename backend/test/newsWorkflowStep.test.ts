import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

vi.mock('../src/util/tokens.js', () => ({
  TOKEN_SYMBOLS: ['BTC'],
  isStablecoin: () => false,
}));

const insertReviewRawLogMock = vi.fn();
vi.mock('../src/repos/agent-review-raw-log.js', () => ({
  insertReviewRawLog: insertReviewRawLogMock,
}));

vi.mock('../src/repos/news.js', () => ({
  getNewsByToken: vi.fn().mockResolvedValue([{ title: 't', link: 'l' }]),
}));

vi.mock('../src/util/ai.js', () => ({
  callAi: vi.fn().mockResolvedValue('res'),
  extractJson: () => ({ comment: 'summary for BTC', score: 1 }),
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('news analyst step', () => {
  it('fetches news summaries', async () => {
    const mod = await import('../src/agents/news-analyst.js');
    const summaries = await mod.runNewsAnalyst(
      createLogger(),
      'gpt',
      'key',
      'agent1',
    );
    expect(summaries.BTC?.comment).toBe('summary for BTC');
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
