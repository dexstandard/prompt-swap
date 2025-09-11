import axios from 'axios';
import { useQueries, useQuery } from '@tanstack/react-query';
import api from './axios';
import { useUser } from './useUser';

export interface BalanceInfo {
  token: string;
  isLoading: boolean;
  walletBalance: number;
  earnBalance: number;
}

export function usePrerequisites(tokens: string[]) {
  const { user } = useUser();

  const aiKeyQuery = useQuery<string | null>({
    queryKey: ['ai-key', user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${user!.id}/ai-key`);
        return res.data.key as string;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });

  const sharedAiKeyQuery = useQuery<string | null>({
    queryKey: ['ai-key-shared', user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${user!.id}/ai-key/shared`);
        return res.data.key as string;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });

  const binanceKeyQuery = useQuery<string | null>({
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

  const hasOpenAIKey = !!aiKeyQuery.data || !!sharedAiKeyQuery.data;
  const hasBinanceKey = !!binanceKeyQuery.data;

  const modelsQuery = useQuery<string[]>({
    queryKey: ['openai-models', user?.id],
    enabled: !!user && hasOpenAIKey,
    queryFn: async () => {
      const res = await api.get(`/users/${user!.id}/models`);
      return res.data.models as string[];
    },
  });

  const balanceQueries = useQueries({
    queries: tokens.map((token) => ({
      queryKey: ['binance-balance', user?.id, token.toUpperCase()],
      enabled: !!user && hasBinanceKey,
      queryFn: async () => {
        const res = await api.get(
          `/users/${user!.id}/binance-balance/${token.toUpperCase()}`,
        );
        return res.data as { asset: string; free: number; locked: number };
      },
    })),
  });

  const earnBalanceQueries = useQueries({
    queries: tokens.map((token) => ({
      queryKey: ['binance-earn-balance', user?.id, token.toUpperCase()],
      enabled: !!user && hasBinanceKey,
      queryFn: async () => {
        try {
          const res = await api.get(
            `/users/${user!.id}/binance-earn-balance/${token.toUpperCase()}`,
          );
          return res.data as { asset: string; total: number };
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 404)
            return { asset: token.toUpperCase(), total: 0 };
          throw err;
        }
      },
    })),
  });

  const balances: BalanceInfo[] = tokens.map((token, idx) => ({
    token,
    isLoading:
      (balanceQueries[idx]?.isLoading ?? false) ||
      (earnBalanceQueries[idx]?.isLoading ?? false),
    walletBalance:
      (balanceQueries[idx]?.data?.free ?? 0) +
      (balanceQueries[idx]?.data?.locked ?? 0),
    earnBalance: earnBalanceQueries[idx]?.data?.total ?? 0,
  }));

  return {
    hasOpenAIKey,
    hasBinanceKey,
    models: modelsQuery.data ?? [],
    balances,
  } as const;
}

