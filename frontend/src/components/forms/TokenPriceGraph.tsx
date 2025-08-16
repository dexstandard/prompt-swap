import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type PricePoint = { time: number; close: number };

function generateStablecoinData(): PricePoint[] {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    time: now - (29 - i) * 24 * 60 * 60 * 1000,
    close: 1,
  }));
}

async function fetchHistory(token: string): Promise<PricePoint[]> {
  const symbol = token.toUpperCase();
  const res = await axios.get(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=30`
  );
  return (res.data as any[]).map((d) => ({ time: d[0], close: Number(d[4]) }));
}

export default function TokenPriceGraph({
  tokenA,
  tokenB,
}: {
  tokenA: string;
  tokenB: string;
}) {
  const query = useQuery<{ time: number; [key: string]: number }[]>({
    queryKey: ['price-history', tokenA, tokenB],
    queryFn: async () => {
      const dataA =
        tokenA === 'USDT' ? generateStablecoinData() : await fetchHistory(tokenA);
      const dataB =
        tokenB === 'USDT' ? generateStablecoinData() : await fetchHistory(tokenB);
      const times = dataA.map((d) => d.time);
      return times.map((time, i) => ({
        time,
        [tokenA]: dataA[i].close,
        [tokenB]: dataB[i].close,
      }));
    },
  });

  if (!query.data?.length || query.isError) return null;

  const data = query.data.map((d) => ({
    time: new Date(d.time).toLocaleDateString(),
    [tokenA]: d[tokenA],
    [tokenB]: d[tokenB],
  }));

  return (
    <div className="bg-white shadow-md rounded p-6 w-full max-w-xl">
      <h2 className="text-xl font-bold mb-4">Price History</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <XAxis dataKey="time" />
            <YAxis yAxisId="left" stroke="#8884d8" />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey={tokenA}
              stroke="#8884d8"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey={tokenB}
              stroke="#82ca9d"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
