import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

vi.mock('../src/services/indicators.js', () => ({
  fetchTokenIndicators: vi.fn().mockResolvedValue({ rsi: 50 }),
}));
vi.mock('../src/services/derivatives.js', () => ({
  fetchOrderBook: vi.fn().mockResolvedValue({ bid: [0, 0], ask: [0, 0] }),
}));

import {
  getTechnicalOutlook,
  getTechnicalOutlookCached,
} from '../src/agents/technical-analyst.js';

function createLogger(): FastifyBaseLogger {
  const log = { info: () => {}, error: () => {}, child: () => log } as unknown as FastifyBaseLogger;
  return log;
}

const responseJson = JSON.stringify({
  object: 'response',
  output: [
    {
      id: 'msg_1',
      content: [
        {
          type: 'output_text',
          text: JSON.stringify({ comment: 'outlook text', score: 5 }),
        },
      ],
    },
  ],
});

describe('technical analyst', () => {
  it('returns outlook', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => responseJson });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const res = await getTechnicalOutlook('BTC', 'gpt', 'key', '1d', createLogger());
    expect(res.analysis?.comment).toBe('outlook text');
    expect(res.prompt).toBeTruthy();
    expect(res.response).toBe(responseJson);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });

  it('falls back when AI response is malformed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => '{"output":[]}' });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const res = await getTechnicalOutlook('BTC', 'gpt', 'key', '1d', createLogger());
    expect(res.analysis?.comment).toBe('Analysis unavailable');
    expect(res.analysis?.score).toBe(0);
    (globalThis as any).fetch = orig;
  });

  it('falls back when AI request fails', async () => {
    const orig = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    (globalThis as any).fetch = fetchMock;
    const res = await getTechnicalOutlook('BTC', 'gpt', 'key', '1d', createLogger());
    expect(res.analysis?.comment).toBe('Analysis unavailable');
    expect(res.analysis?.score).toBe(0);
    (globalThis as any).fetch = orig;
  });

  it('caches token outlooks and dedupes concurrent calls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => responseJson });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const p1 = getTechnicalOutlookCached('BTC', 'gpt', 'key', '1d', createLogger());
    const p2 = getTechnicalOutlookCached('BTC', 'gpt', 'key', '1d', createLogger());
    await Promise.all([p1, p2]);
    await getTechnicalOutlookCached('BTC', 'gpt', 'key', '1d', createLogger());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });
});
