import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { getCache, clearCache } from '../src/util/cache.js';
import type { Analysis } from '../src/services/types.js';

const getOrderBookAnalysisMock = vi.fn((pair: string) =>
  Promise.resolve({ comment: `analysis for ${pair}`, score: 3 }),
);
vi.mock('../src/services/order-book-analyst.js', () => ({
  getOrderBookAnalysis: getOrderBookAnalysisMock,
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('order book analyst step', () => {
  beforeEach(() => {
    clearCache();
    getOrderBookAnalysisMock.mockClear();
  });

  it('caches order book analysis per pair', async () => {
    const { runOrderBookAnalyst } = await import('../src/workflows/portfolio-review.js');
    await runOrderBookAnalyst(createLogger(), 'gpt', 'key', 'run1');

    const analysis = await getCache<Analysis>(`orderbook:gpt:BTCUSDT:run1`);
    expect(analysis?.comment).toBe('analysis for BTCUSDT');
  });
});
