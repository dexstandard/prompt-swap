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

describe('technical analyst step', () => {
  it('fetches technical outlook per token', async () => {
    const mod = await import('../src/agents/technical-analyst.js');
    vi.spyOn(mod, 'getTechnicalOutlook').mockResolvedValue({
      analysis: { comment: 'outlook for BTC', score: 2 },
      prompt: { instructions: '', input: {} },
      response: 'res',
    });
    const outlooks = await mod.runTechnicalAnalyst(
      createLogger(),
      'gpt',
      'key',
      '1d',
      'agent1',
    );
    expect(outlooks.BTC?.comment).toBe('outlook for BTC');
    expect(mod.getTechnicalOutlook).toHaveBeenCalled();
    expect(insertReviewRawLogMock).toHaveBeenCalled();
  });
});
