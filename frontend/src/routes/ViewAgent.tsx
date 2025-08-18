import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import AgentBalance from '../components/AgentBalance';
import AgentForm from '../components/forms/AgentForm';
import PriceChart from '../components/forms/PriceChart';
import ErrorBoundary from '../components/ErrorBoundary';
import Button from '../components/ui/Button';

interface Agent {
  id: string;
  userId: string;
  model: string | null;
  status: 'active' | 'inactive';
  draft: boolean;
  createdAt: number;
  name: string | null;
  tokenA: string | null;
  tokenB: string | null;
  targetAllocation: number | null;
  minTokenAAllocation: number | null;
  minTokenBAllocation: number | null;
  risk: string | null;
  reviewInterval: string | null;
  agentInstructions: string | null;
}

export default function ViewAgent() {
  const { id } = useParams();
  const { user } = useUser();
  const [tokens, setTokens] = useState({ tokenA: 'USDT', tokenB: 'SOL' });
  const { data, refetch } = useQuery({
    queryKey: ['agent', id, user?.id],
    queryFn: async () => {
      const res = await api.get(`/agents/${id}`);
      return res.data as Agent;
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (data?.tokenA && data?.tokenB) {
      setTokens({ tokenA: data.tokenA, tokenB: data.tokenB });
    }
  }, [data?.tokenA, data?.tokenB]);

  if (!data) return <div className="p-4">Loading...</div>;

  if (data.draft) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Agent Draft</h1>
        <div className="flex gap-3 items-stretch">
          <ErrorBoundary>
            <PriceChart tokenA={tokens.tokenA} tokenB={tokens.tokenB} />
          </ErrorBoundary>
          <div className="flex-1">
            <AgentForm
              agent={data}
              onTokensChange={(a, b) => setTokens({ tokenA: a, tokenB: b })}
              onSubmitSuccess={() => refetch()}
            />
            <Button
              type="button"
              className="w-full mt-4"
              onClick={async () => {
                await api.put(`/agents/${data.id}`, {
                  ...data,
                  userId: data.userId,
                  status: 'active',
                  draft: false,
                });
                await refetch();
              }}
            >
              Start Agent
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Agent</h1>
      <p>
        <strong>Model:</strong> {data.model}
      </p>
      <p>
        <strong>Status:</strong> <AgentStatusLabel status={data.status} />
      </p>
      <p>
        <strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}
      </p>
      {data.tokenA && data.tokenB ? (
        <>
          <p className="flex items-center gap-1">
            <strong>Tokens:</strong>
            <TokenDisplay token={data.tokenA} />
            <span>/</span>
            <TokenDisplay token={data.tokenB} />
          </p>
          <p>
            <strong>Balance (USD):</strong>{' '}
            <AgentBalance tokenA={data.tokenA} tokenB={data.tokenB} />
          </p>
          <div className="my-4">
            <ErrorBoundary>
              <PriceChart tokenA={data.tokenA} tokenB={data.tokenB} />
            </ErrorBoundary>
          </div>
        </>
      ) : (
        <p>No token information available.</p>
      )}
    </div>
  );
}

