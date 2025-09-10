import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

const getTokenNewsSummaryMock = vi.fn(
  (
    token: string,
    _model?: string,
    _apiKey?: string,
    _log?: FastifyBaseLogger,
  ) =>
    Promise.resolve({
      analysis: { comment: `news ${token}`, score: 1 },
      prompt: { token },
      response: 'r',
    }),
);
vi.mock('../src/services/news-analyst.js', () => ({
  getTokenNewsSummary: getTokenNewsSummaryMock,
}));

const getTechnicalOutlookMock = vi.fn(
  (
    token: string,
    _model?: string,
    _apiKey?: string,
    _timeframe?: string,
    _log?: FastifyBaseLogger,
  ) =>
    Promise.resolve({
      analysis: { comment: `tech ${token}`, score: 2 },
      prompt: { token },
      response: 'r',
    }),
);
vi.mock('../src/services/technical-analyst.js', () => ({
  getTechnicalOutlook: getTechnicalOutlookMock,
}));

const getOrderBookAnalysisMock = vi.fn(
  (
    pair: string,
    _model?: string,
    _apiKey?: string,
    _log?: FastifyBaseLogger,
  ) =>
    Promise.resolve({
      analysis: { comment: `order ${pair}`, score: 3 },
      prompt: { pair },
      response: 'r',
    }),
);
vi.mock('../src/services/order-book-analyst.js', () => ({
  getOrderBookAnalysis: getOrderBookAnalysisMock,
}));

const getPerformanceAnalysisMock = vi.fn(() =>
  Promise.resolve({ analysis: { comment: 'perf', score: 4 }, prompt: { a: 1 }, response: 'r' }),
);
vi.mock('../src/services/performance-analyst.js', () => ({
  getPerformanceAnalysis: getPerformanceAnalysisMock,
}));

const getRecentLimitOrdersMock = vi.fn(() => Promise.resolve([]));
vi.mock('../src/repos/limit-orders.js', () => ({
  getRecentLimitOrders: getRecentLimitOrdersMock,
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

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('main trader step', () => {
  beforeEach(() => {
    getTokenNewsSummaryMock.mockClear();
    getTechnicalOutlookMock.mockClear();
    getOrderBookAnalysisMock.mockClear();
    getPerformanceAnalysisMock.mockClear();
    getRecentLimitOrdersMock.mockClear();
    callAiMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('runs traders and skips stablecoins', async () => {
    const { runMainTrader } = await import('../src/agents/portfolio-review.js');
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
    expect(getPerformanceAnalysisMock).toHaveBeenCalled();
    expect(getTokenNewsSummaryMock).not.toHaveBeenCalledWith('USDT');
    expect(getTokenNewsSummaryMock).not.toHaveBeenCalledWith('USDC');
    expect(getTechnicalOutlookMock).not.toHaveBeenCalledWith('USDT');
    expect(getTechnicalOutlookMock).not.toHaveBeenCalledWith('USDC');
  });
});
