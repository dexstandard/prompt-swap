import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

const runNewsAnalystMock = vi.fn(() =>
  Promise.resolve({ BTC: { comment: 'news BTC', score: 1 } }),
);
vi.mock('../src/agents/news-analyst.js', () => ({
  runNewsAnalyst: runNewsAnalystMock,
}));

const runTechnicalAnalystMock = vi.fn(() =>
  Promise.resolve({ BTC: { comment: 'tech BTC', score: 2 } }),
);
vi.mock('../src/agents/technical-analyst.js', () => ({
  runTechnicalAnalyst: runTechnicalAnalystMock,
}));

const runOrderBookAnalystMock = vi.fn(() =>
  Promise.resolve({ BTC: { comment: 'order BTCUSDT', score: 3 } }),
);
vi.mock('../src/agents/order-book-analyst.js', () => ({
  runOrderBookAnalyst: runOrderBookAnalystMock,
}));

const runPerformanceAnalyzerMock = vi.fn(() =>
  Promise.resolve({ comment: 'perf', score: 4 }),
);
vi.mock('../src/agents/performance-analyst.js', () => ({
  runPerformanceAnalyzer: runPerformanceAnalyzerMock,
}));

const callAiMock = vi.fn(() =>
  Promise.resolve(
    JSON.stringify({
      output: [
        {
          id: 'msg_1',
          content: [
            {
              text: JSON.stringify({
                result: { rebalance: true, newAllocation: 50, shortReport: 'ok' },
              }),
            },
          ],
        },
      ],
    }),
  ),
);
vi.mock('../src/util/ai.js', () => ({
  callAi: callAiMock,
  developerInstructions: '',
  rebalanceResponseSchema: {},
}));

const insertReviewRawLogMock = vi.fn(() => Promise.resolve('1'));
vi.mock('../src/repos/agent-review-raw-log.js', () => ({
  insertReviewRawLog: insertReviewRawLogMock,
}));

const getRecentLimitOrdersMock = vi.fn(() => Promise.resolve([
  {
    planned_json: JSON.stringify({ symbol: 'BTCUSDT', side: 'BUY' }),
    status: 'filled',
    created_at: new Date(),
  },
]));
vi.mock('../src/repos/limit-orders.js', () => ({
  getRecentLimitOrders: getRecentLimitOrdersMock,
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('main trader step', () => {
  beforeEach(() => {
    runNewsAnalystMock.mockClear();
    runTechnicalAnalystMock.mockClear();
    runOrderBookAnalystMock.mockClear();
    runPerformanceAnalyzerMock.mockClear();
    callAiMock.mockClear();
    insertReviewRawLogMock.mockClear();
    getRecentLimitOrdersMock.mockClear();
  });

  it('runs traders and aggregates analyses', async () => {
    const { runMainTrader } = await import('../src/agents/main-trader.js');
    const decision = await runMainTrader(
      createLogger(),
      'gpt',
      'key',
      '1d',
      'agent1',
      'pf1',
    );

    expect(decision?.rebalance).toBe(true);
    expect(insertReviewRawLogMock).toHaveBeenCalled();
    expect(runPerformanceAnalyzerMock).toHaveBeenCalled();
    expect(runNewsAnalystMock).toHaveBeenCalled();
    expect(runTechnicalAnalystMock).toHaveBeenCalled();
    expect(runOrderBookAnalystMock).toHaveBeenCalled();
  });
});
