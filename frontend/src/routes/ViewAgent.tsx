import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';

interface Agent {
  id: string;
  templateId: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive';
  createdAt: number;
  template?: {
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

  const template = data.template;

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
      {template ? (
        <>
          <p>
            <strong>Pair:</strong>{' '}
            <TokenDisplay token={template.tokenA} />/
            <TokenDisplay token={template.tokenB} />
          </p>
          <p>
            <strong>Risk:</strong> {template.risk}
          </p>
          <p>
            <strong>Rebalance:</strong> {template.rebalance}
          </p>
          <p>
            <strong>Target Allocation:</strong> {template.targetAllocation}/
            {100 - template.targetAllocation}
          </p>
          <p>
            <strong>Minimum {template.tokenA} Allocation:</strong> {template.minTokenAAllocation}%
          </p>
          <p>
            <strong>Minimum {template.tokenB} Allocation:</strong> {template.minTokenBAllocation}%
          </p>
          <p>
            <strong>Instructions:</strong> {template.agentInstructions}
          </p>
        </>
      ) : (
        <p>No template information available.</p>
      )}
    </div>
  );
}

