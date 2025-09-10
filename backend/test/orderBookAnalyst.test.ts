import { describe, it, expect, vi, beforeEach } from 'vitest';

const responseJson = JSON.stringify({
  object: 'response',
  output: [
    {
      id: 'msg_1',
      content: [
        {
          type: 'output_text',
          text: JSON.stringify({ comment: 'order book summary', score: 5 }),
        },
      ],
    },
  ],
});

const fetchOrderBookMock = vi.fn();
const callAiMock = vi.fn();

vi.mock('../src/services/derivatives.js', () => ({
  fetchOrderBook: fetchOrderBookMock,
}));

vi.mock('../src/util/ai.js', () => ({
  callAi: callAiMock,
  extractJson: (res: string) =>
    JSON.parse(JSON.parse(res).output[0].content[0].text),
}));

describe('order book analyst service', () => {
  beforeEach(() => {
    fetchOrderBookMock.mockReset();
    callAiMock.mockReset();
  });

  it('waits for in-flight analysis and returns cached result', async () => {
    fetchOrderBookMock.mockResolvedValue({ bids: [], asks: [] });
    callAiMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return responseJson;
    });
    const { getOrderBookAnalysis } = await import(
      '../src/services/order-book-analyst.js'
    );
    const [a1, a2] = await Promise.all([
      getOrderBookAnalysis('BTCUSDT', 'gpt', 'key'),
      getOrderBookAnalysis('BTCUSDT', 'gpt', 'key'),
    ]);
    expect(a1?.comment).toBe('order book summary');
    expect(a2?.comment).toBe('order book summary');
    expect(callAiMock).toHaveBeenCalledTimes(1);
  });
});

