import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';

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
          text: JSON.stringify({ comment: 'order book summary', score: 5 }),
        },
      ],
    },
  ],
});

const fetchOrderBookMock = vi.fn();
const callAiMock = vi.fn();
const extractJsonMock = vi.fn(
  (res: string) => JSON.parse(JSON.parse(res).output[0].content[0].text),
);

vi.mock('../src/services/derivatives.js', () => ({
  fetchOrderBook: fetchOrderBookMock,
}));

vi.mock('../src/util/ai.js', () => ({
  callAi: callAiMock,
  extractJson: extractJsonMock,
  compactJson: (v: unknown) => JSON.stringify(v),
}));

describe('order book analyst service', () => {
  beforeEach(() => {
    fetchOrderBookMock.mockReset();
    callAiMock.mockReset();
    extractJsonMock.mockReset();
  });

  it('returns analysis', async () => {
    fetchOrderBookMock.mockResolvedValue({ bids: [], asks: [] });
    callAiMock.mockResolvedValue(responseJson);
    const { getOrderBookAnalysis } = await import(
      '../src/agents/order-book-analyst.js'
    );
    const res = await getOrderBookAnalysis('BTCUSDT', 'gpt', 'key', createLogger());
    expect(res.analysis?.comment).toBe('order book summary');
    expect(res.prompt).toBeTruthy();
    expect(res.response).toBe(responseJson);
    expect(callAiMock).toHaveBeenCalledTimes(1);
  });

  it('falls back when AI response is malformed', async () => {
    fetchOrderBookMock.mockResolvedValue({ bids: [], asks: [] });
    callAiMock.mockResolvedValue('bad');
    extractJsonMock.mockReturnValue(null);
    const { getOrderBookAnalysis } = await import(
      '../src/agents/order-book-analyst.js'
    );
    const res = await getOrderBookAnalysis('BTCUSDT', 'gpt', 'key', createLogger());
    expect(res.analysis?.comment).toBe('Analysis unavailable');
    expect(res.analysis?.score).toBe(0);
  });

  it('falls back when AI request fails', async () => {
    fetchOrderBookMock.mockResolvedValue({ bids: [], asks: [] });
    callAiMock.mockRejectedValue(new Error('network'));
    const { getOrderBookAnalysis } = await import(
      '../src/agents/order-book-analyst.js'
    );
    const res = await getOrderBookAnalysis('BTCUSDT', 'gpt', 'key', createLogger());
    expect(res.analysis?.comment).toBe('Analysis unavailable');
    expect(res.analysis?.score).toBe(0);
  });
});

