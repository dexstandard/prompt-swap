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

  it('returns outlook', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => responseJson });
    const orig = globalThis.fetch;
    (globalThis as any).fetch = fetchMock;
    const res = await getTechnicalOutlook('BTC', 'gpt', 'key', '1d', 'a1');
    expect(res?.comment).toBe('outlook text');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    (globalThis as any).fetch = orig;
  });
});
