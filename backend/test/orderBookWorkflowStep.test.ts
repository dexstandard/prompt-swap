import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

const callAiMock = vi.fn(() => Promise.resolve('res'));
const extractJsonMock = vi.fn(() => ({ comment: 'analysis for BTCUSDT', score: 3 }));
vi.mock('../src/util/ai.js', () => ({
  callAi: callAiMock,
  extractJson: extractJsonMock,
  compactJson: (v: unknown) => JSON.stringify(v),
}));

vi.mock('../src/services/derivatives.js', () => ({
  fetchOrderBook: vi.fn(() => Promise.resolve({ bids: [], asks: [] })),
}));

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
    const { runOrderBookAnalyst } = await import('../src/agents/order-book-analyst.js');
    const analyses = await runOrderBookAnalyst(createLogger(), 'gpt', 'key', 'agent1');
    expect(analyses.BTC?.comment).toBe('analysis for BTCUSDT');
    expect(callAiMock).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
