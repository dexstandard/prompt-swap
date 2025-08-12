import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../lib/axios';
import type { NewPool, Pool } from '../types';

export function usePools() {
  const queryClient = useQueryClient();

  const poolsQuery = useQuery<Pool[]>({
    queryKey: ['pools'],
    queryFn: async () => {
      const { data } = await axios.get<Pool[]>('/pools');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: NewPool) => {
      const { data } = await axios.post<Pool>('/pools', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'paused' }) => {
      const { data } = await axios.patch<Pool>(`/pools/${id}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
  });

  return { poolsQuery, createMutation, statusMutation };
}
