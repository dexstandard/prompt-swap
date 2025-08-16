import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';

interface Agent {
  id: string;
  templateId: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive';
  createdAt: number;
  template: {
    tokenA: string;
    tokenB: string;
    targetAllocation: number;
    minTokenAAllocation: number;
    minTokenBAllocation: number;
    risk: string;
    rebalance: string;
    agentInstructions: string;
  };
}

export default function ViewAgent() {
  const { id } = useParams();
  const { user } = useUser();
  const { data } = useQuery({
    queryKey: ['agent', id, user?.id],
    queryFn: async () => {
      const res = await api.get(`/agents/${id}`, {
        headers: { 'x-user-id': user!.id },
      });
      return res.data as Agent;
    },
    enabled: !!id && !!user,
  });

  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Agent {data.id}</h1>
      <p>
        <strong>Pair:</strong> {data.template.tokenA}/{data.template.tokenB}
      </p>
      <p>
        <strong>Model:</strong> {data.model}
      </p>
      <p>
        <strong>Status:</strong> <AgentStatusLabel status={data.status} />
      </p>
      <p>
        <strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}
      </p>
      <p>
        <strong>Risk:</strong> {data.template.risk}
      </p>
      <p>
        <strong>Rebalance:</strong> {data.template.rebalance}
      </p>
      <p>
        <strong>Target Allocation:</strong> {data.template.targetAllocation}/
        {100 - data.template.targetAllocation}
      </p>
      <p>
        <strong>Minimum {data.template.tokenA} Allocation:</strong>{' '}
        {data.template.minTokenAAllocation}%
      </p>
      <p>
        <strong>Minimum {data.template.tokenB} Allocation:</strong>{' '}
        {data.template.minTokenBAllocation}%
      </p>
      <p>
        <strong>Instructions:</strong> {data.template.agentInstructions}
      </p>
    </div>
  );
}

