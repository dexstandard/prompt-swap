import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/user';

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
  const { user } = useUser();
  const { data } = useQuery({
    queryKey: ['index', id],
    queryFn: async () => {
      const res = await api.get(`/indexes/${id}`);
      return res.data as IndexDetails;
    },
    enabled: !!id,
  });

  const balanceA = useQuery({
    queryKey: ['binance-balance', user?.id, data?.tokenA?.toUpperCase()],
    enabled: !!user && !!data?.tokenA,
    queryFn: async () => {
      const res = await api.get(
        `/users/${user!.id}/binance-balance/${data!.tokenA.toUpperCase()}`,
        { headers: { 'x-user-id': user!.id } }
      );
      return res.data as { asset: string; free: number; locked: number };
    },
  });

  const balanceB = useQuery({
    queryKey: ['binance-balance', user?.id, data?.tokenB?.toUpperCase()],
    enabled: !!user && !!data?.tokenB,
    queryFn: async () => {
      const res = await api.get(
        `/users/${user!.id}/binance-balance/${data!.tokenB.toUpperCase()}`,
        { headers: { 'x-user-id': user!.id } }
      );
      return res.data as { asset: string; free: number; locked: number };
    },
  });

  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">{`${data.tokenA.toUpperCase()}/${data.tokenB.toUpperCase()}`}</h1>
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
      <div className="mt-4">
        <h2 className="text-xl font-bold mb-2">Binance Balances</h2>
        <p>
          <strong>{data.tokenA.toUpperCase()}:</strong>{' '}
          {balanceA.isLoading
            ? 'Loading...'
            : (balanceA.data?.free ?? 0) + (balanceA.data?.locked ?? 0)}
        </p>
        <p>
          <strong>{data.tokenB.toUpperCase()}:</strong>{' '}
          {balanceB.isLoading
            ? 'Loading...'
            : (balanceB.data?.free ?? 0) + (balanceB.data?.locked ?? 0)}
        </p>
        <p className="mt-2 text-sm text-red-600">
          Trading agent will use all available balance for chosen tokens on spot
          wallet. Move excess funds to futures before trading.
        </p>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => console.log('Start trading')}
        >
          Start trading
        </button>
      </div>
    </div>
  );
}
