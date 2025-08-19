import { useEffect, useState } from 'react';
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
import AiApiKeySection from '../components/forms/AiApiKeySection';
import ExchangeApiKeySection from '../components/forms/ExchangeApiKeySection';
import WalletBalances from '../components/WalletBalances';
import { useToast } from '../components/Toast';

interface Agent {
  id: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive';
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
  draft: boolean;
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

  const aiKeyQuery = useQuery<string | null>({
    queryKey: ['ai-key', user?.id],
    enabled: !!user && !!data?.draft,
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
  const hasOpenAIKey = !!aiKeyQuery.data;

  const binanceKeyQuery = useQuery<string | null>({
    queryKey: ['binance-key', user?.id],
    enabled: !!user && !!data?.draft,
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
  const hasBinanceKey = !!binanceKeyQuery.data;

  const modelsQuery = useQuery<string[]>({
    queryKey: ['openai-models', user?.id],
    enabled: !!user && hasOpenAIKey && !!data?.draft && !data?.model,
    queryFn: async () => {
      const res = await api.get(`/users/${user!.id}/models`);
      return res.data.models as string[];
    },
  });

  const [model, setModel] = useState('');
  useEffect(() => {
    setModel(data?.model || '');
  }, [data?.model]);
  useEffect(() => {
    if (!data?.model && modelsQuery.data && modelsQuery.data.length && !model) {
      setModel(modelsQuery.data[0]);
    }
  }, [modelsQuery.data, data?.model, model]);

  const updateMut = useMutation({
    mutationFn: async (newModel: string) => {
      if (!data) return;
      await api.put(`/agents/${id}`, {
        userId: data.userId,
        model: newModel,
        status: data.status,
        name: data.name,
        tokenA: data.tokenA,
        tokenB: data.tokenB,
        targetAllocation: data.targetAllocation,
        minTokenAAllocation: data.minTokenAAllocation,
        minTokenBAllocation: data.minTokenBAllocation,
        risk: data.risk,
        reviewInterval: data.reviewInterval,
        agentInstructions: data.agentInstructions,
        draft: data.draft,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent', id, user?.id] }),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to update draft');
      }
      setModel(data?.model || '');
    },
  });

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
      <h1 className="text-2xl font-bold mb-2">
        Agent {data.draft && '(Draft)'}
      </h1>
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
      <div className="mt-4">
        {data.draft && !hasOpenAIKey && !data.model ? (
          <AiApiKeySection label="OpenAI API Key" />
        ) : (
          <div>
            <h2 className="text-md font-bold mb-1">Model</h2>
            {data.model ? (
              <p>{data.model}</p>
            ) : data.draft && hasOpenAIKey && modelsQuery.data ? (
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="border rounded p-2"
              >
                {modelsQuery.data.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        )}
      </div>
      {data.draft && !hasBinanceKey && (
        <div className="mt-4">
          <ExchangeApiKeySection
            exchange="binance"
            label="Binance API Credentials"
          />
        </div>
      )}
      {data.draft && hasBinanceKey && (
        <div className="mt-4">
          <WalletBalances tokens={[data.tokenA, data.tokenB]} />
        </div>
      )}
      <p>
        <strong>Status:</strong> <AgentStatusLabel status={data.status} />
      </p>
      <p>
        <strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}
      </p>
      {!data.draft && (
        <p>
          <strong>Balance (USD):</strong>{' '}
          <AgentBalance tokenA={data.tokenA} tokenB={data.tokenB} />
        </p>
      )}
      {!isActive && data.draft && data.model && hasOpenAIKey && hasBinanceKey ? (
        <Button
          className="mt-4"
          disabled={startMut.isPending}
          loading={startMut.isPending}
          onClick={() => startMut.mutate()}
        >
          Start Agent
        </Button>
      ) : isActive ? (
        <Button
          className="mt-4"
          disabled={stopMut.isPending}
          loading={stopMut.isPending}
          onClick={() => stopMut.mutate()}
        >
          Stop Agent
        </Button>
      ) : data.draft && hasOpenAIKey && !data.model && modelsQuery.data ? (
        <Button
          className="mt-4"
          disabled={updateMut.isPending}
          loading={updateMut.isPending}
          onClick={() => updateMut.mutate(model)}
        >
          Save Draft
        </Button>
      ) : null}
    </div>
  );
}

