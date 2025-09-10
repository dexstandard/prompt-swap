import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { getCache, clearCache } from '../src/util/cache.js';
import type { Analysis } from '../src/services/types.js';

const getTokenNewsSummaryMock = vi.fn((token: string) =>
  Promise.resolve({ comment: `summary for ${token}`, score: 1 }),
);
vi.mock('../src/services/news-analyst.js', () => ({
  getTokenNewsSummary: getTokenNewsSummaryMock,
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('news analyst step', () => {
  beforeEach(() => {
    clearCache();
    getTokenNewsSummaryMock.mockClear();
  });

  it('caches token list and news summaries', async () => {
    const { runNewsAnalyst } = await import('../src/workflows/portfolio-review.js');
    await runNewsAnalyst(createLogger(), 'gpt', 'key', 'run1', 'agent1');

    const tokens = await getCache<string[]>(`tokens:gpt`);
    expect(tokens).toContain('BTC');

    const summary = await getCache<Analysis>(`news:gpt:BTC:run1`);
    expect(summary?.comment).toBe('summary for BTC');
  });
});
