import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import AgentBalance from '../components/AgentBalance';

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

  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Agent</h1>
      <p>
        <strong>Model:</strong> {data.model || '-'}
      </p>
      <p>
        <strong>Status:</strong> <AgentStatusLabel status={data.status} />
      </p>
      <p>
        <strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}
      </p>
      <p>
        <strong>Name:</strong>{' '}
        <Link
          to="/agent-preview"
          state={{
            name: data.name,
            tokenA: data.tokenA,
            tokenB: data.tokenB,
            targetAllocation: data.targetAllocation,
            minTokenAAllocation: data.minTokenAAllocation,
            minTokenBAllocation: data.minTokenBAllocation,
            risk: data.risk,
            reviewInterval: data.reviewInterval,
            agentInstructions: data.agentInstructions,
          }}
          className="text-blue-600 underline"
        >
          {data.name}
        </Link>
      </p>
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
    </div>
  );
}

