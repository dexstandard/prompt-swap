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

  it('caches summary by token and logs first call', async () => {
    await db.query(
      "INSERT INTO news (title, link, pub_date, tokens) VALUES ('t', 'l', NOW(), ARRAY['BTC'])",
    );
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => responseJson });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const s1 = await getTokenNewsSummary('BTC', 'gpt', 'key', { agentId: 'a1' });
    const s2 = await getTokenNewsSummary('BTC', 'gpt', 'key', { agentId: 'a1' });
    expect(s1?.comment).toBe('summary text');
    expect(s2?.comment).toBe('summary text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(insertReviewRawLogMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });

  it('dedupes concurrent requests', async () => {
    await db.query(
      "INSERT INTO news (title, link, pub_date, tokens) VALUES ('t', 'l', NOW(), ARRAY['ETH'])",
    );
    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { text: async () => responseJson };
    });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const [r1, r2] = await Promise.all([
      getTokenNewsSummary('ETH', 'gpt', 'key'),
      getTokenNewsSummary('ETH', 'gpt', 'key'),
    ]);
    expect(r1?.comment).toBe('summary text');
    expect(r2?.comment).toBe('summary text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });

  it('does not cache empty summaries', async () => {
    const orig = globalThis.fetch;
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
    const { getTokenNewsSummary } = await import('../src/services/news-analyst.js');
    const first = await getTokenNewsSummary('DOGE', 'gpt', 'key');
    expect(first).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await db.query(
      "INSERT INTO news (title, link, pub_date, tokens) VALUES ('t', 'l', NOW(), ARRAY['DOGE'])",
    );
    const fetchMock2 = vi.fn().mockResolvedValue({ text: async () => responseJson });
    (globalThis as any).fetch = fetchMock2;
    const second = await getTokenNewsSummary('DOGE', 'gpt', 'key');
    expect(second?.comment).toBe('summary text');
    expect(fetchMock2).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });
});

