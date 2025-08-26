import { useQuery } from '@tanstack/react-query';
import api from './axios';
import { useUser } from './useUser';

export interface Agent {
  id: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive' | 'draft';
  createdAt: number;
  name: string;
  tokenA: string;
  tokenB: string;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
  startBalanceUsd: number | null;
  manualRebalance: boolean;
}

export function useAgentData(id?: string) {
  const { user } = useUser();
  return useQuery({
    queryKey: ['agent', id, user?.id],
    queryFn: async () => {
      const res = await api.get(`/agents/${id}`);
      return res.data as Agent;
    },
    enabled: !!id && !!user,
  });
}

