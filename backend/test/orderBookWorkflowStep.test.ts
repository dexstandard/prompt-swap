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

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('order book analyst step', () => {
  it('fetches order book analysis per pair', async () => {
    const mod = await import('../src/agents/order-book-analyst.js');
    vi.spyOn(mod, 'getOrderBookAnalysis').mockResolvedValue({
      analysis: { comment: 'analysis for BTCUSDT', score: 3 },
      prompt: { instructions: '', input: {} },
      response: 'res',
    });
    const analyses = await mod.runOrderBookAnalyst(createLogger(), 'gpt', 'key', 'agent1');
    expect(analyses.BTC?.comment).toBe('analysis for BTCUSDT');
    expect(mod.getOrderBookAnalysis).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
