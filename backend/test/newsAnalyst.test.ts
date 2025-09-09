import { describe, it, expect, vi } from 'vitest';
import { db } from '../src/db/index.js';
import { getTokenNewsSummary } from '../src/services/news-analyst.js';

const responseJson = JSON.stringify({
  object: 'response',
  output: [
    {
      id: 'msg_1',
      content: [{ type: 'output_text', text: 'summary text' }],
    },
  ],
});

describe('news analyst', () => {
  it('caches summary by token', async () => {
    await db.query(
      "INSERT INTO news (title, link, pub_date, tokens) VALUES ('t', 'l', NOW(), ARRAY['BTC'])",
    );
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => responseJson });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const s1 = await getTokenNewsSummary('BTC', 'gpt', 'key');
    const s2 = await getTokenNewsSummary('BTC', 'gpt', 'key');
    expect(s1).toBe('summary text');
    expect(s2).toBe('summary text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    const [r1, r2] = await Promise.all([
      getTokenNewsSummary('ETH', 'gpt', 'key'),
      getTokenNewsSummary('ETH', 'gpt', 'key'),
    ]);
    expect(r1).toBe('summary text');
    expect(r2).toBe('summary text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });
});
