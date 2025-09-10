import { describe, it, expect, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { db } from '../src/db/index.js';

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
          text: JSON.stringify({ comment: 'summary text', score: 1 }),
        },
      ],
    },
  ],
});

describe('news analyst', () => {
  it('returns summary and raw data', async () => {
    await db.query(
      "INSERT INTO news (title, link, pub_date, tokens) VALUES ('t', 'l', NOW(), ARRAY['BTC'])",
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => responseJson });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const res = await getTokenNewsSummary('BTC', 'gpt', 'key', createLogger());
    expect(res.analysis?.comment).toBe('summary text');
    expect(res.prompt).toBeTruthy();
    expect(res.response).toBe(responseJson);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });

  it('returns null when no news available', async () => {
    const orig = globalThis.fetch;
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const res = await getTokenNewsSummary('DOGE', 'gpt', 'key', createLogger());
    expect(res.analysis).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    (globalThis as any).fetch = orig;
  });

  it('falls back when AI response is malformed', async () => {
    await db.query(
      "INSERT INTO news (title, link, pub_date, tokens) VALUES ('t2', 'l2', NOW(), ARRAY['BTC'])",
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => '{"output":[]}' });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const res = await getTokenNewsSummary('BTC', 'gpt', 'key', createLogger());
    expect(res.analysis?.comment).toBe('Analysis unavailable');
    expect(res.analysis?.score).toBe(0);
    (globalThis as any).fetch = orig;
  });

  it('falls back when AI request fails', async () => {
    await db.query(
      "INSERT INTO news (title, link, pub_date, tokens) VALUES ('t3', 'l3', NOW(), ARRAY['BTC'])",
    );
    const orig = globalThis.fetch;
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const res = await getTokenNewsSummary('BTC', 'gpt', 'key', createLogger());
    expect(res.analysis?.comment).toBe('Analysis unavailable');
    expect(res.analysis?.score).toBe(0);
    (globalThis as any).fetch = orig;
  });
});

