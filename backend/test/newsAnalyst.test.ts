import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../src/db/index.js';

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

const insertReviewRawLogMock = vi.fn();
vi.mock('../src/repos/agent-review-raw-log.js', () => ({
  insertReviewRawLog: insertReviewRawLogMock,
}));

describe('news analyst', () => {
  beforeEach(() => {
    insertReviewRawLogMock.mockClear();
  });

  it('returns summary and logs request', async () => {
    await db.query(
      "INSERT INTO news (title, link, pub_date, tokens) VALUES ('t', 'l', NOW(), ARRAY['BTC'])",
    );
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => responseJson });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const summary = await getTokenNewsSummary('BTC', 'gpt', 'key', 'a1');
    expect(summary?.comment).toBe('summary text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(insertReviewRawLogMock).toHaveBeenCalled();
    (globalThis as any).fetch = orig;
  });

  it('returns null when no news available', async () => {
    const orig = globalThis.fetch;
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const summary = await getTokenNewsSummary('DOGE', 'gpt', 'key');
    expect(summary).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    (globalThis as any).fetch = orig;
  });
});

