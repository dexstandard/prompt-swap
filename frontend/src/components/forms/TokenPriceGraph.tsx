import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { createChart, LineSeries } from 'lightweight-charts';
import type { ISeriesApi, UTCTimestamp } from 'lightweight-charts';

type PricePoint = { time: number; open: number; high: number; low: number; close: number };

function generateStablecoinData(): PricePoint[] {
  const now = Date.now();
  return Array.from({ length: 365 }, (_, i) => ({
    time: now - (364 - i) * 24 * 60 * 60 * 1000,
    open: 1,
    high: 1,
    low: 1,
    close: 1,
  }));
}

type Kline = [number, string, string, string, string, ...unknown[]];

async function fetchHistory(token: string): Promise<PricePoint[]> {
  const symbol = token.toUpperCase();
  const res = await axios.get<Kline[]>(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=365`
  );
  return res.data.map((d) => ({
    time: d[0],
    open: Number(d[1]),
    high: Number(d[2]),
    low: Number(d[3]),
    close: Number(d[4]),
  }));
}

export default function TokenPriceGraph({
  tokenA,
  tokenB,
}: {
  tokenA: string;
  tokenB: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesARef = useRef<ISeriesApi<'Line'> | null>(null);
  const seriesBRef = useRef<ISeriesApi<'Line'> | null>(null);

  const query = useQuery<{ [key: string]: PricePoint[] }>({
    queryKey: ['price-history', tokenA, tokenB],
    queryFn: async () => {
      const dataA =
        tokenA === 'USDT' ? generateStablecoinData() : await fetchHistory(tokenA);
      const dataB =
        tokenB === 'USDT' ? generateStablecoinData() : await fetchHistory(tokenB);
      return { [tokenA]: dataA, [tokenB]: dataB };
    },
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      rightPriceScale: { visible: true },
      leftPriceScale: { visible: true },
      layout: { background: { color: 'transparent' }, textColor: 'black' },
    });

    const seriesA = chart.addSeries(LineSeries, {
      priceScaleId: 'left',
      color: '#2962FF',
    });
    const seriesB = chart.addSeries(LineSeries, {
      priceScaleId: 'right',
      color: '#D32F2F',
    });
    seriesARef.current = seriesA;
    seriesBRef.current = seriesB;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.resize(width, height);
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!query.data || !seriesARef.current || !seriesBRef.current) return;

    seriesARef.current.setData(
      query.data[tokenA].map((d) => ({
        time: (d.time / 1000) as UTCTimestamp,
        value: d.close,
      }))
    );
    seriesBRef.current.setData(
      query.data[tokenB].map((d) => ({
        time: (d.time / 1000) as UTCTimestamp,
        value: d.close,
      }))
    );
  }, [query.data, tokenA, tokenB]);

  return (
    <div className="bg-white shadow-md border border-gray-200 rounded p-6 flex-1 min-w-0">
      <h2 className="text-xl font-bold mb-4">Price History</h2>
      <div className="h-[600px] relative">
        <div ref={containerRef} className="absolute inset-0" />
        {query.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Loading...
          </div>
        )}
        {query.isError && (
          <div className="absolute inset-0 flex items-center justify-center text-red-500">
            Failed to load price data
          </div>
        )}
      </div>
    </div>
  );
}
