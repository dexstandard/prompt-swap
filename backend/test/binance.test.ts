import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPairData } from '../src/services/binance.js';

describe('fetchPairData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives week and month from yearly klines', async () => {
    const yearData = Array.from({ length: 365 }, (_, i) => [i]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ bids: [], asks: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => yearData });
    vi.stubGlobal('fetch', fetchMock as any);

    const data = await fetchPairData('BTC', 'USDT');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(data.week).toEqual(yearData.slice(-7));
    expect(data.month).toEqual(yearData.slice(-30));
    expect(data.year).toEqual(yearData);
  });
});
