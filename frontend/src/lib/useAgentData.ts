import { useQuery } from '@tanstack/react-query';
import api from './axios';
import { useUser } from './useUser';
import type { PortfolioReviewFormValues } from './constants';

export interface Agent {
  id: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive' | 'draft';
  createdAt: number;
  name: string;
  tokens: { token: string; minAllocation: number }[];
  risk: PortfolioReviewFormValues['risk'];
  reviewInterval: PortfolioReviewFormValues['reviewInterval'];
  agentInstructions: string;
  startBalanceUsd: number | null;
  manualRebalance: boolean;
  useEarn: boolean;
  aiApiKeyId: string | null;
  exchangeApiKeyId: string | null;
}

export function useAgentData(id?: string) {
  const { user } = useUser();
  return useQuery({
    queryKey: ['agent', id, user?.id],
    queryFn: async () => {
      const res = await api.get(`/portfolio-workflows/${id}`);
      return res.data as Agent;
    },
    enabled: !!id && !!user,
  });
}

