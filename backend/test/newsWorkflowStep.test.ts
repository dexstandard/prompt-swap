import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

const callAiMock = vi.fn(() => Promise.resolve('res'));
const extractJsonMock = vi.fn(() => ({ comment: 'summary for BTC', score: 1 }));
vi.mock('../src/util/ai.js', () => ({
  callAi: callAiMock,
  extractJson: extractJsonMock,
  compactJson: (v: unknown) => JSON.stringify(v),
}));

vi.mock('../src/repos/news.js', () => ({
  getNewsByToken: vi.fn(() => Promise.resolve([{ title: 't', link: 'l' }])),
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

describe('news analyst step', () => {
  it('fetches news summaries', async () => {
    const { runNewsAnalyst } = await import('../src/agents/news-analyst.js');
    const summaries = await runNewsAnalyst(createLogger(), 'gpt', 'key', 'agent1');
    expect(summaries.BTC?.comment).toBe('summary for BTC');
    expect(callAiMock).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
