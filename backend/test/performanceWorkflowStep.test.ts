import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type { Analysis } from '../src/agents/types.js';

const callAiMock = vi.fn(() => Promise.resolve('r'));
const extractJsonMock = vi.fn(() => ({ comment: 'perf', score: 4 }));
vi.mock('../src/util/ai.js', () => ({
  callAi: callAiMock,
  extractJson: extractJsonMock,
  compactJson: (v: unknown) => JSON.stringify(v),
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
    callAiMock.mockClear();
    extractJsonMock.mockClear();
    getRecentLimitOrdersMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('fetches performance analysis', async () => {
    const { runPerformanceAnalyzer } = await import('../src/agents/performance-analyst.js');
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
      'agent1',
      reports,
    );
    expect(perf?.comment).toBe('perf');
    expect(getRecentLimitOrdersMock).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
    expect(callAiMock).toHaveBeenCalled();
    expect(extractJsonMock).toHaveBeenCalled();
  });
});
