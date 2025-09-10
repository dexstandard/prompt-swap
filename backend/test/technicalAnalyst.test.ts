import { describe, it, expect, vi } from 'vitest';
import { getTechnicalOutlook } from '../src/services/technical-analyst.js';

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
  vi.mock('../src/services/indicators.js', () => ({
    fetchTokenIndicators: vi.fn().mockResolvedValue({ rsi: 50 }),
  }));

  it('caches outlook by token and timeframe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => responseJson });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const o1 = await getTechnicalOutlook('BTC', 'gpt', 'key', '1d');
    const o2 = await getTechnicalOutlook('BTC', 'gpt', 'key', '1d');
    expect(o1?.comment).toBe('outlook text');
    expect(o2?.comment).toBe('outlook text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });

  it('dedupes concurrent requests', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { text: async () => responseJson };
      });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const [r1, r2] = await Promise.all([
      getTechnicalOutlook('ETH', 'gpt', 'key', '1h'),
      getTechnicalOutlook('ETH', 'gpt', 'key', '1h'),
    ]);
    expect(r1?.comment).toBe('outlook text');
    expect(r2?.comment).toBe('outlook text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });
});
