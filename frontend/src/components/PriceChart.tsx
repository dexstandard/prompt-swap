import {useEffect, useRef} from 'react';
import {createChart, CandlestickData} from 'lightweight-charts';

interface PriceChartProps {
  symbol: string;
}

export default function PriceChart({symbol}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 300,
    });
    const series = chart.addCandlestickSeries();

    async function load() {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=365`
      );
      if (!res.ok) return;
      const json = (await res.json()) as any[];
      const data: CandlestickData[] = json.map((k) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
      }));
      series.setData(data);
    }
    load();

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol]);

  return <div ref={containerRef} className="w-full h-[300px]" />;
}
