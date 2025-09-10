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
  fetchTokenIndicators: vi.fn().mockResolvedValue({}),
}));

const responseJson = JSON.stringify({
  output: [
    {
      id: 'msg_1',
      content: [
        {
          type: 'output_text',
          text: JSON.stringify({ comment: 'outlook for BTC', score: 2 }),
        },
      ],
    },
  ],
});

vi.mock('../src/util/ai.js', async () => {
  const actual = await vi.importActual<typeof import('../src/util/ai.js')>(
    '../src/util/ai.js',
  );
  return {
    ...actual,
    callAi: vi.fn().mockResolvedValue(responseJson),
  };
});

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('technical analyst step', () => {
  it('fetches technical outlook per token', async () => {
    const mod = await import('../src/agents/technical-analyst.js');
    const outlooks = await mod.runTechnicalAnalyst(
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
