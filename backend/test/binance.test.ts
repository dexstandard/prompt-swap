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

  it('retries with reversed pair on invalid symbol', async () => {
    const errRes = {
      ok: false,
      text: async () => JSON.stringify({ code: -1121, msg: 'Invalid symbol.' }),
    } as any;
    const yearData = Array.from({ length: 365 }, (_, i) => [i]);
    const fetchMock = vi
      .fn()
      // initial invalid pair (4 calls)
      .mockResolvedValueOnce(errRes)
      .mockResolvedValueOnce(errRes)
      .mockResolvedValueOnce(errRes)
      .mockResolvedValueOnce(errRes)
      // reversed pair succeeds
      .mockResolvedValueOnce({ ok: true, json: async () => ({ price: '1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bids: [], asks: [] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => yearData });
    vi.stubGlobal('fetch', fetchMock as any);

    const data = await fetchPairData('USDT', 'BTC');
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(data.year).toEqual(yearData);
  });
});
