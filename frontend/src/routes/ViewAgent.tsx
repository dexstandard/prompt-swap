import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import RiskDisplay from '../components/RiskDisplay';

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
    reviewInterval: string;
    agentInstructions: string;
  };
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

  const template = data.template;
  const reviewIntervalMap: Record<string, string> = {
    '1h': '1 Hour',
    '3h': '3 Hours',
    '5h': '5 Hours',
    '12h': '12 Hours',
    '24h': '1 Day',
    '3d': '3 Days',
    '1w': '1 Week',
  };
  const reviewIntervalLabel =
    reviewIntervalMap[template?.reviewInterval ?? ''] ?? template?.reviewInterval;

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
          <p className="flex items-center gap-1">
            <strong>Tokens:</strong>
            <TokenDisplay token={template.tokenA} />
            <span>/</span>
            <TokenDisplay token={template.tokenB} />
          </p>
          <p className="flex items-center gap-1">
            <strong>Risk:</strong>
            <RiskDisplay risk={template.risk} />
          </p>
          <p>
            <strong>Review Interval:</strong> {reviewIntervalLabel}
          </p>
          <p>
            <strong>Target Allocation:</strong> {template.targetAllocation} / {100 - template.targetAllocation}
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

