import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { setCache, getCache, clearCache } from '../src/util/cache.js';
import type { Analysis } from '../src/services/types.js';

const getPerformanceAnalysisMock = vi.fn(() =>
  Promise.resolve({ analysis: { comment: 'perf', score: 4 }, prompt: { a: 1 }, response: 'r' }),
);
vi.mock('../src/services/performance-analyst.js', () => ({
  getPerformanceAnalysis: getPerformanceAnalysisMock,
}));

const insertReviewRawLogMock = vi.fn();
vi.mock('../src/repos/agent-review-raw-log.js', () => ({
  insertReviewRawLog: insertReviewRawLogMock,
}));

const getRecentLimitOrdersMock = vi.fn(() =>
  Promise.resolve([
    {
      planned_json: JSON.stringify({ symbol: 'BTCUSDT', side: 'BUY' }),
      status: 'filled',
      created_at: new Date(),
    },
  ]),
);
vi.mock('../src/repos/limit-orders.js', () => ({
  getRecentLimitOrders: getRecentLimitOrdersMock,
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('performance analyzer step', () => {
  beforeEach(() => {
    clearCache();
    getPerformanceAnalysisMock.mockClear();
    getRecentLimitOrdersMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('caches performance analysis', async () => {
    const { runPerformanceAnalyzer } = await import('../src/workflows/portfolio-review.js');
    await setCache('tokens:gpt', ['BTC']);
    await setCache('news:gpt:BTC:run1', { comment: 'n', score: 1 });
    await setCache('tech:gpt:BTC:1d:run1', { comment: 't', score: 2 });
    await setCache('orderbook:gpt:BTCUSDT:run1', { comment: 'o', score: 3 });

    await runPerformanceAnalyzer(createLogger(), 'gpt', 'key', '1d', 'agent1', 'run1');

    const perf = await getCache<Analysis>('performance:gpt:agent1:run1');
    expect(perf?.comment).toBe('perf');
    expect(getPerformanceAnalysisMock).toHaveBeenCalled();
    expect(getRecentLimitOrdersMock).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
