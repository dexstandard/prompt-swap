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

  it('returns analysis', async () => {
    fetchOrderBookMock.mockResolvedValue({ bids: [], asks: [] });
    callAiMock.mockResolvedValue(responseJson);
    const { getOrderBookAnalysis } = await import(
      '../src/services/order-book-analyst.js'
    );
    const res = await getOrderBookAnalysis('BTCUSDT', 'gpt', 'key');
    expect(res.analysis?.comment).toBe('order book summary');
    expect(res.prompt).toBeTruthy();
    expect(res.response).toBe(responseJson);
    expect(callAiMock).toHaveBeenCalledTimes(1);
  });
});

