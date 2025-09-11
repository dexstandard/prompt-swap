import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from './axios';
import { useUser } from './useUser';
import { useToast } from './useToast';

export function useAgentActions(id?: string) {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const toast = useToast();

  const startMut = useMutation({
    mutationFn: async () => {
      await api.post(`/portfolio-workflows/${id}/start`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['agent', id, user?.id] }),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to start agent');
      }
    },
  });

  const stopMut = useMutation({
    mutationFn: async () => {
      await api.post(`/portfolio-workflows/${id}/stop`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['agent', id, user?.id] }),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to stop agent');
      }
    },
  });

  return { startMut, stopMut } as const;
}

