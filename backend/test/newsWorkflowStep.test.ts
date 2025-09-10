import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type { Analysis } from '../src/services/types.js';

const getTokenNewsSummaryMock = vi.fn(
  (token: string) =>
    Promise.resolve({
      analysis: { comment: `summary for ${token}`, score: 1 },
      prompt: { token },
      response: 'r',
    }),
);
vi.mock('../src/services/news-analyst.js', () => ({
  getTokenNewsSummary: getTokenNewsSummaryMock,
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
  beforeEach(() => {
    getTokenNewsSummaryMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('fetches news summaries', async () => {
    const { runNewsAnalyst } = await import('../src/agents/portfolio-review.js');
    const summaries = await runNewsAnalyst(createLogger(), 'gpt', 'key', 'agent1');
    expect(summaries.BTC?.comment).toBe('summary for BTC');
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
