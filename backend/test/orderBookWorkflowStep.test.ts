import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type { Analysis } from '../src/services/types.js';

const getOrderBookAnalysisMock = vi.fn((pair: string) =>
  Promise.resolve({
    analysis: { comment: `analysis for ${pair}`, score: 3 },
    prompt: { pair },
    response: 'r',
  }),
);
vi.mock('../src/services/order-book-analyst.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/order-book-analyst.js')>(
    '../src/services/order-book-analyst.js',
  );
  return {
    ...actual,
    getOrderBookAnalysis: getOrderBookAnalysisMock,
  };
});

const insertReviewRawLogMock = vi.fn();
vi.mock('../src/repos/agent-review-raw-log.js', () => ({
  insertReviewRawLog: insertReviewRawLogMock,
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('order book analyst step', () => {
  beforeEach(() => {
    getOrderBookAnalysisMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('fetches order book analysis per pair', async () => {
    const { runOrderBookAnalyst } = await import('../src/services/order-book-analyst.js');
    const analyses = await runOrderBookAnalyst(createLogger(), 'gpt', 'key', 'agent1');
    expect(analyses.BTC?.comment).toBe('analysis for BTCUSDT');
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
