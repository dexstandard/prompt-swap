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

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('news analyst step', () => {
  it('fetches news summaries', async () => {
    const mod = await import('../src/agents/news-analyst.js');
    vi.spyOn(mod, 'getTokenNewsSummary').mockResolvedValue({
      analysis: { comment: 'summary for BTC', score: 1 },
      prompt: { instructions: '', input: {} },
      response: 'res',
    });

    const summaries = await mod.runNewsAnalyst(createLogger(), 'gpt', 'key', 'agent1');
    expect(summaries.BTC?.comment).toBe('summary for BTC');
    expect(mod.getTokenNewsSummary).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
