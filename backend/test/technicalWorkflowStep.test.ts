import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { getCache, clearCache } from '../src/util/cache.js';
import type { Analysis } from '../src/services/types.js';

const getTechnicalOutlookMock = vi.fn((token: string) =>
  Promise.resolve({ comment: `outlook for ${token}`, score: 2 }),
);
vi.mock('../src/services/technical-analyst.js', () => ({
  getTechnicalOutlook: getTechnicalOutlookMock,
}));

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

describe('technical analyst step', () => {
  beforeEach(() => {
    clearCache();
    getTechnicalOutlookMock.mockClear();
  });

  it('caches technical outlook per token', async () => {
    const { runTechnicalAnalyst } = await import('../src/workflows/portfolio-review.js');
    await runTechnicalAnalyst(createLogger(), 'gpt', 'key', '1d', 'run1');

    const outlook = await getCache<Analysis>(`tech:gpt:BTC:1d:run1`);
    expect(outlook?.comment).toBe('outlook for BTC');
  });
});
