import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type { Analysis } from '../src/agents/types.js';

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

vi.mock('../src/util/ai.js', () => ({
  callAi: vi.fn().mockResolvedValue('res'),
  extractJson: () => ({ comment: 'perf', score: 4 }),
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('performance analyzer step', () => {
  beforeEach(() => {
    getRecentLimitOrdersMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('fetches performance analysis', async () => {
    const mod = await import('../src/agents/performance-analyst.js');
    const reports = [
      {
        token: 'BTC',
        news: { comment: 'n', score: 1 } as Analysis,
        tech: { comment: 't', score: 2 } as Analysis,
        orderbook: { comment: 'o', score: 3 } as Analysis,
      },
    ];
    const perf = await mod.runPerformanceAnalyzer(
      createLogger(),
      'gpt',
      'key',
      'agent1',
      reports,
    );
    expect(perf?.comment).toBe('perf');
    expect(getRecentLimitOrdersMock).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
