import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export default function TokenPriceGraph({ token }: { token: string }) {
  const { data, isError } = useQuery<{ time: number; close: number }[]>({
    queryKey: ['price-history', token],
    enabled: token !== 'USDT',
    queryFn: async () => {
      const symbol = token.toUpperCase();
      const res = await axios.get(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=30`
      );
      return (res.data as any[]).map((d) => ({ time: d[0], close: Number(d[4]) }));
    },
  });

  if (!data?.length || isError) return null;

  const max = Math.max(...data.map((p) => p.close));
  const min = Math.min(...data.map((p) => p.close));
  const points = data
    .map((p, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = max === min ? 50 : ((max - p.close) / (max - min)) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="w-full h-24">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <polyline
          fill="none"
          stroke="blue"
          strokeWidth="1"
          points={points}
        />
      </svg>
    </div>
  );
}
