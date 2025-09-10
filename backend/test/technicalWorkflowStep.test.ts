import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import type { Analysis } from '../src/services/types.js';

const getTechnicalOutlookMock = vi.fn((token: string) =>
  Promise.resolve({
    analysis: { comment: `outlook for ${token}`, score: 2 },
    prompt: { token },
    response: 'r',
  }),
);
vi.mock('../src/services/technical-analyst.js', () => ({
  getTechnicalOutlook: getTechnicalOutlookMock,
}));

const insertReviewRawLogMock = vi.fn();
vi.mock('../src/repos/agent-review-raw-log.js', () => ({
  insertReviewRawLog: insertReviewRawLogMock,
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('technical analyst step', () => {
  beforeEach(() => {
    getTechnicalOutlookMock.mockClear();
    insertReviewRawLogMock.mockClear();
  });

  it('fetches technical outlook per token', async () => {
    const { runTechnicalAnalyst } = await import('../src/agents/portfolio-review.js');
    const outlooks = await runTechnicalAnalyst(
      createLogger(),
      'gpt',
      'key',
      '1d',
      'agent1',
    );
    expect(outlooks.BTC?.comment).toBe('outlook for BTC');
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
