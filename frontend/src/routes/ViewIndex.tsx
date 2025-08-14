import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';

interface IndexDetails {
  id: string;
  userId: string;
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  rebalance: string;
  model: string;
  tvl: number;
  systemPrompt: string;
}

export default function ViewIndex() {
  const { id } = useParams();
  const { data } = useQuery({
    queryKey: ['index', id],
    queryFn: async () => {
      const res = await api.get(`/indexes/${id}`);
      return res.data as IndexDetails;
    },
    enabled: !!id,
  });

  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{`${data.tokenA}/${data.tokenB}`}</h1>
      <p>
        <strong>User:</strong> {data.userId}
      </p>
      <p>
        <strong>Target Allocation:</strong> {data.targetAllocation}%/{100 - data.targetAllocation}%
      </p>
      <p>
        <strong>Minimum Allocation:</strong> {data.minTokenAAllocation}%/{data.minTokenBAllocation}%
      </p>
      <p>
        <strong>Risk:</strong> {data.risk}
      </p>
      <p>
        <strong>Rebalance Frequency:</strong> {data.rebalance}
      </p>
      <p>
        <strong>AI Model:</strong> {data.model}
      </p>
      <p>
        <strong>TVL:</strong> {data.tvl}
      </p>
      <div className="mt-4">
        <h2 className="text-xl font-bold mb-2">System Prompt</h2>
        <pre className="whitespace-pre-wrap">{data.systemPrompt}</pre>
      </div>
    </div>
  );
}
