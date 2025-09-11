import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import api from './axios';
import { useUser } from './useUser';

export interface BinanceAccount {
  balances: { asset: string; free: number; locked: number }[];
}

export function useBinanceAccount() {
  const { user } = useUser();
  return useQuery<BinanceAccount>({
    queryKey: ['binance-account', user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${user!.id}/binance-account`);
        return res.data as BinanceAccount;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          return { balances: [] };
        }
        throw err;
      }
    },
  });
}
