import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { useUser } from '../../lib/user';

export default function TokenPriceGraph({ token }: { token: string }) {
  const { user } = useUser();
  const { data, isError } = useQuery<{ time: number; close: number }[]>({
    queryKey: ['price-history', user?.id, token],
    enabled: !!user && token !== 'USDT',
    queryFn: async () => {
      const res = await api.get(`/users/${user!.id}/binance-prices/${token}`);
      return res.data.prices as { time: number; close: number }[];
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
