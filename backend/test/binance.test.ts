import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPairData } from '../src/services/binance.js';

describe('fetchPairData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches yearly klines and omits week/month slices', async () => {
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
    expect(data.symbol).toBe('BTCUSDT');
    expect(data.year).toEqual(yearData);
    expect('week' in data).toBe(false);
    expect('month' in data).toBe(false);
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
    expect(data.symbol).toBe('BTCUSDT');
    expect(data.year).toEqual(yearData);
  });
});
