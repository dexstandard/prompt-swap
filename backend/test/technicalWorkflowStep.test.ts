import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

vi.mock('../src/util/tokens.js', () => ({
  TOKEN_SYMBOLS: ['BTC'],
  isStablecoin: () => false,
}));

const insertReviewRawLogMock = vi.fn();
vi.mock('../src/repos/agent-review-raw-log.js', () => ({
  insertReviewRawLog: insertReviewRawLogMock,
}));

vi.mock('../src/services/indicators.js', () => ({
  fetchTokenIndicators: vi.fn().mockResolvedValue({
    ret: {},
    sma_dist: {},
    macd_hist: 0,
    vol: {},
    range: {},
    volume: {},
    corr: {},
    regime: {},
    osc: {},
  }),
}));
vi.mock('../src/services/derivatives.js', () => ({
  fetchOrderBook: vi.fn().mockResolvedValue({ bid: [0, 0], ask: [0, 0] }),
}));

vi.mock('../src/util/ai.js', () => ({
  callAi: vi.fn().mockResolvedValue('res'),
  extractJson: () => ({ comment: 'outlook for BTC', score: 2 }),
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('technical analyst step', () => {
  it('fetches technical outlook per token', async () => {
    const mod = await import('../src/agents/technical-analyst.js');
    const prompt: any = {};
    await mod.runTechnicalAnalyst(
      {
        log: createLogger(),
        model: 'gpt',
        apiKey: 'key',
        timeframe: '1d',
        portfolioId: 'agent1',
      },
      prompt,
    );
    const report = prompt.reports?.find((r: any) => r.token === 'BTC');
    expect(report?.tech?.comment).toBe('outlook for BTC');
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
