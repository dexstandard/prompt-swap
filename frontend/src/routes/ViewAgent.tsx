import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import AgentBalance from '../components/AgentBalance';
import RiskDisplay from '../components/RiskDisplay';
import Button from '../components/ui/Button';
import { useToast } from '../components/Toast';
import AgentPreview from './AgentPreview';

interface Agent {
  id: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive' | 'draft';
  createdAt: number;
  name: string;
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
}

export default function ViewAgent() {
  const { id } = useParams();
  const { user } = useUser();
  const { data } = useQuery({
    queryKey: ['agent', id, user?.id],
    queryFn: async () => {
      const res = await api.get(`/agents/${id}`);
      return res.data as Agent;
    },
    enabled: !!id && !!user,
  });
  const queryClient = useQueryClient();
  const toast = useToast();

  const startMut = useMutation({
    mutationFn: async () => {
      await api.post(`/agents/${id}/start`);
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
      await api.post(`/agents/${id}/stop`);
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

  if (!data) return <div className="p-4">Loading...</div>;
  if (data.status === 'draft') return <AgentPreview draft={data} />;

  const reviewIntervalMap: Record<string, string> = {
    '1h': '1 Hour',
    '3h': '3 Hours',
    '5h': '5 Hours',
    '12h': '12 Hours',
    '24h': '1 Day',
    '3d': '3 Days',
    '1w': '1 Week',
  };
  const reviewIntervalLabel = reviewIntervalMap[data.reviewInterval] ?? data.reviewInterval;
  const isActive = data.status === 'active';

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">Agent</h1>
      <h2 className="text-xl font-bold mb-2">{data.name}</h2>
      <p className="flex items-center gap-1">
        <strong>Tokens:</strong>
        <TokenDisplay token={data.tokenA} />
        <span>/</span>
        <TokenDisplay token={data.tokenB} />
      </p>
      <p>
        <strong>Target Allocation:</strong> {data.targetAllocation} /{' '}
        {100 - data.targetAllocation}
      </p>
      <p>
        <strong>Minimum {data.tokenA.toUpperCase()} Allocation:</strong>{' '}
        {data.minTokenAAllocation}%
      </p>
      <p>
        <strong>Minimum {data.tokenB.toUpperCase()} Allocation:</strong>{' '}
        {data.minTokenBAllocation}%
      </p>
      <p className="flex items-center gap-1">
        <strong>Risk Tolerance:</strong> <RiskDisplay risk={data.risk} />
      </p>
      <p>
        <strong>Review Interval:</strong> {reviewIntervalLabel}
      </p>
      <div className="mt-4">
        <h2 className="text-xl font-bold">Trading Agent Instructions</h2>
        <pre className="whitespace-pre-wrap">{data.agentInstructions}</pre>
      </div>
      <p>
        <strong>Status:</strong> <AgentStatusLabel status={data.status} />
      </p>
      <p>
        <strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}
      </p>
      <p>
        <strong>Balance (USD):</strong>{' '}
        <AgentBalance tokenA={data.tokenA} tokenB={data.tokenB} />
      </p>
      {isActive ? (
        <Button
          className="mt-4"
          disabled={stopMut.isPending}
          loading={stopMut.isPending}
          onClick={() => stopMut.mutate()}
        >
          Stop Agent
        </Button>
      ) : (
        <Button
          className="mt-4"
          disabled={startMut.isPending}
          loading={startMut.isPending}
          onClick={() => startMut.mutate()}
        >
          Start Agent
        </Button>
      )}
    </div>
  );
}

