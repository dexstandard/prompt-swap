import axios from 'axios';
import { useQueries, useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';

interface Props {
  tokenA: string;
  tokenB: string;
}

export default function AgentBalance({ tokenA, tokenB }: Props) {
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

  const balanceQueries = useQueries({
    queries: [tokenA, tokenB].map((token) => ({
      queryKey: ['binance-balance-usd', user?.id, token.toUpperCase()],
      enabled: !!user && !!binanceKey,
      queryFn: async () => {
        const res = await api.get(
          `/users/${user!.id}/binance-balance/${token.toUpperCase()}`
        );
        const bal = res.data as { free: number; locked: number };
        const amount = (bal.free ?? 0) + (bal.locked ?? 0);
        if (!amount) return 0;
        if (token.toUpperCase() === 'USDT') return amount;
        const priceRes = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${token.toUpperCase()}USDT`
        );
        if (!priceRes.ok) return 0;
        const priceData = (await priceRes.json()) as { price: string };
        return amount * Number(priceData.price);
      },
    })),
  });

  if (!user || !binanceKey) return <span>-</span>;
  const isLoading = balanceQueries.some((q) => q.isLoading);
  const total = balanceQueries.reduce((sum, q) => sum + (q.data ?? 0), 0);
  return <span>{isLoading ? 'Loading...' : `$${total.toFixed(2)}`}</span>;
}
