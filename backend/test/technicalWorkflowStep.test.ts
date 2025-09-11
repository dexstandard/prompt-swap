import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

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

const callAiMock = vi.fn().mockResolvedValue('res');
vi.mock('../src/util/ai.js', () => ({
  callAi: callAiMock,
  extractJson: () => ({ comment: 'outlook for BTC', score: 2 }),
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('technical analyst step', () => {
  it('fetches technical outlook per token', async () => {
    const mod = await import('../src/agents/technical-analyst.js');
    const prompt: any = {
      marketData: {},
      reports: [
        { token: 'BTC', news: null, tech: null },
        { token: 'USDC', news: null, tech: null },
      ],
    };
    await mod.runTechnicalAnalyst(
      {
        log: createLogger(),
        model: 'gpt',
        apiKey: 'key',
        portfolioId: 'agent1',
      },
      prompt,
    );
    const report = prompt.reports?.find((r: any) => r.token === 'BTC');
    expect(report?.tech?.comment).toBe('outlook for BTC');
    expect(prompt.reports?.find((r: any) => r.token === 'USDC')?.tech).toBeNull();
    expect(prompt.marketData.indicators.BTC).toBeDefined();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
    expect(callAiMock).toHaveBeenCalledTimes(1);
  });
});
