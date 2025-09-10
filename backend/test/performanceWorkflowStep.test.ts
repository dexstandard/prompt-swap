import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type { Analysis } from '../src/services/types.js';

const getPerformanceAnalysisMock = vi.fn(
  (
    _input?: unknown,
    _model?: string,
    _apiKey?: string,
    _log?: FastifyBaseLogger,
  ) =>
    Promise.resolve({
      analysis: { comment: 'perf', score: 4 },
      prompt: { a: 1 },
      response: 'r',
    }),
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
    getPerformanceAnalysisMock.mockClear();
    getRecentLimitOrdersMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('fetches performance analysis', async () => {
    const { runPerformanceAnalyzer } = await import('../src/agents/portfolio-review.js');
    const reports = [
      {
        token: 'BTC',
        news: { comment: 'n', score: 1 } as Analysis,
        tech: { comment: 't', score: 2 } as Analysis,
        orderbook: { comment: 'o', score: 3 } as Analysis,
      },
    ];
    const perf = await runPerformanceAnalyzer(
      createLogger(),
      'gpt',
      'key',
      '1d',
      'agent1',
      reports,
    );
    expect(perf?.comment).toBe('perf');
    expect(getPerformanceAnalysisMock).toHaveBeenCalled();
    expect(getRecentLimitOrdersMock).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
