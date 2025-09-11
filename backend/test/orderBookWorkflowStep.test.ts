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

vi.mock('../src/services/derivatives.js', () => ({
  fetchOrderBook: vi.fn().mockResolvedValue({ bids: [], asks: [] }),
}));

vi.mock('../src/util/ai.js', () => ({
  callAi: vi.fn().mockResolvedValue('res'),
  extractJson: () => ({ comment: 'analysis for BTCUSDT', score: 3 }),
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('order book analyst step', () => {
  it('fetches order book analysis per pair', async () => {
    const mod = await import('../src/agents/order-book-analyst.js');
    const prompt: any = {};
    await mod.runOrderBookAnalyst(
      createLogger(),
      'gpt',
      'key',
      'agent1',
      prompt,
    );
    const report = prompt.reports?.find((r: any) => r.token === 'BTC');
    expect(report?.orderbook?.comment).toBe('analysis for BTCUSDT');
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
