import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

const runNewsAnalystMock = vi.fn(
  (
    _log: FastifyBaseLogger,
    _model: string,
    _apiKey: string,
    _agentId: string,
    prompt: any,
  ) => {
    prompt.reports[0].news = { comment: 'news BTC', score: 1 };
    return Promise.resolve();
  },
);
vi.mock('../src/agents/news-analyst.js', () => ({
  runNewsAnalyst: runNewsAnalystMock,
}));

const runTechnicalAnalystMock = vi.fn(
  (
    _log: FastifyBaseLogger,
    _model: string,
    _apiKey: string,
    _timeframe: string,
    _agentId: string,
    prompt: any,
  ) => {
    prompt.reports[0].tech = { comment: 'tech BTC', score: 2 };
    return Promise.resolve();
  },
);
vi.mock('../src/agents/technical-analyst.js', () => ({
  runTechnicalAnalyst: runTechnicalAnalystMock,
}));

const runOrderBookAnalystMock = vi.fn(
  (
    _log: FastifyBaseLogger,
    _model: string,
    _apiKey: string,
    _agentId: string,
    prompt: any,
  ) => {
    prompt.reports[0].orderbook = { comment: 'order BTCUSDT', score: 3 };
    return Promise.resolve();
  },
);
vi.mock('../src/agents/order-book-analyst.js', () => ({
  runOrderBookAnalyst: runOrderBookAnalystMock,
}));

const runPerformanceAnalyzerMock = vi.fn(
  (
    _log: FastifyBaseLogger,
    _model: string,
    _apiKey: string,
    _agentId: string,
    prompt: any,
  ) => {
    prompt.performance = { comment: 'perf', score: 4 };
    return Promise.resolve();
  },
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
  });

  it('runs traders and aggregates analyses', async () => {
    const { runMainTrader } = await import('../src/agents/main-trader.js');
    const prompt = {
      instructions: '',
      policy: { floor: {} },
      portfolio: { ts: new Date().toISOString(), positions: [] },
      marketData: { currentPrice: 0 },
      reports: [{ token: 'BTC', news: null, tech: null, orderbook: null }],
    };
    const decision = await runMainTrader(
      createLogger(),
      'gpt',
      'key',
      '1d',
      'agent1',
      'pf1',
      prompt,
    );

    expect(decision?.rebalance).toBe(true);
    expect(runPerformanceAnalyzerMock).toHaveBeenCalled();
    expect(runNewsAnalystMock).toHaveBeenCalled();
    expect(runTechnicalAnalystMock).toHaveBeenCalled();
    expect(runOrderBookAnalystMock).toHaveBeenCalled();
  });
});
