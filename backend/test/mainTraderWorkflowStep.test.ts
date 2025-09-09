import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { getCache, clearCache } from '../src/util/cache.js';

const getTokenNewsSummaryMock = vi.fn((token: string) =>
  Promise.resolve({ comment: `news ${token}`, score: 1 }),
);
vi.mock('../src/services/news-analyst.js', () => ({
  getTokenNewsSummary: getTokenNewsSummaryMock,
}));

const getTechnicalOutlookMock = vi.fn((token: string) =>
  Promise.resolve({ comment: `tech ${token}`, score: 2 }),
);
vi.mock('../src/services/technical-analyst.js', () => ({
  getTechnicalOutlook: getTechnicalOutlookMock,
}));

const getOrderBookAnalysisMock = vi.fn((pair: string) =>
  Promise.resolve({ comment: `order ${pair}`, score: 3 }),
);
vi.mock('../src/services/order-book-analyst.js', () => ({
  getOrderBookAnalysis: getOrderBookAnalysisMock,
}));

const callTraderAgentMock = vi.fn(() =>
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
vi.mock('../src/util/ai.js', () => ({ callTraderAgent: callTraderAgentMock }));

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
    clearCache();
    getTokenNewsSummaryMock.mockClear();
    getTechnicalOutlookMock.mockClear();
    getOrderBookAnalysisMock.mockClear();
    callTraderAgentMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('caches portfolio decision', async () => {
    const { runMainTrader } = await import('../src/workflows/portfolio-review.js');
    await runMainTrader(createLogger(), 'gpt', 'key', '1d', 'agent1', 'pf1', 'run1');

    const decision = await getCache<any>(`portfolio:gpt:pf1:run1`);
    expect(decision.rebalance).toBe(true);
    expect(decision.newAllocation).toBe(50);
    expect(callTraderAgentMock).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
