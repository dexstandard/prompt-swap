import axios from 'axios';
import { useQueries, useQuery } from '@tanstack/react-query';
import TokenDisplay from './TokenDisplay';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';

interface Props {
  tokens: string[];
}

export default function BinanceBalances({ tokens }: Props) {
  const { user } = useUser();
  const { data: binanceKey } = useQuery<string | null>({
    queryKey: ['binance-key', user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${user!.id}/binance-key`);
        return res.data.key as string;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });

  if (!user || !binanceKey) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-2">Binance Balances</h2>
        <p>Binance Balances - Unavailable</p>
      </div>
    );
  }

  const balanceQueries = useQueries({
    queries: tokens.map((token) => ({
      queryKey: ['binance-balance', user.id, token.toUpperCase()],
      queryFn: async () => {
        const res = await api.get(
          `/users/${user.id}/binance-balance/${token.toUpperCase()}`,
          { headers: { 'x-user-id': user.id } }
        );
        return res.data as { asset: string; free: number; locked: number };
      },
    })),
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Binance Balances</h2>
      {tokens.map((token, idx) => (
        <p key={token}>
          <TokenDisplay token={token} className="font-bold" />:{' '}
          {balanceQueries[idx].isLoading
            ? 'Loading...'
            : (balanceQueries[idx].data?.free ?? 0) +
              (balanceQueries[idx].data?.locked ?? 0)}
        </p>
      ))}
    </div>
  );
}
