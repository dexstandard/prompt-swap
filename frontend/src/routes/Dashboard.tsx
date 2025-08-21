import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, Trash } from 'lucide-react';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import AgentBalance from '../components/AgentBalance';
import Button from '../components/ui/Button';
import CreateAgentForm from '../components/forms/CreateAgentForm';
import PriceChart from '../components/forms/PriceChart';
import ErrorBoundary from '../components/ErrorBoundary';
import { useToast } from '../components/Toast';

interface Agent {
  id: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive' | 'draft';
  tokenA?: string;
  tokenB?: string;
}

export default function Dashboard() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [tokens, setTokens] = useState({ tokenA: 'USDT', tokenB: 'SOL' });
  const [onlyActive, setOnlyActive] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const handleTokensChange = useCallback((a: string, b: string) => {
    setTokens((prev) =>
      prev.tokenA === a && prev.tokenB === b ? prev : { tokenA: a, tokenB: b }
    );
  }, []);

  const { data } = useQuery({
    queryKey: ['agents', page, user?.id, onlyActive],
    queryFn: async () => {
      const res = await api.get('/agents/paginated', {
        params: {
          page,
          pageSize: 10,
          userId: user!.id,
          status: onlyActive ? 'active' : undefined,
        },
      });
      return res.data as {
        items: Agent[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
    enabled: !!user,
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const items = data?.items ?? [];

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/agents/${id}`);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.show('Agent deleted', 'success');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to delete agent');
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex gap-3 items-stretch">
        <ErrorBoundary>
          <PriceChart tokenA={tokens.tokenA} tokenB={tokens.tokenB} />
        </ErrorBoundary>
        <CreateAgentForm onTokensChange={handleTokensChange} />
      </div>
      <ErrorBoundary>
        <div className="bg-white shadow-md border border-gray-200 rounded p-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">My Agents</h2>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <span>Only Active</span>
              <input
                type="checkbox"
                className="sr-only peer"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
              />
              <div className="ml-2 relative w-10 h-5 bg-gray-200 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white" />
            </label>
          </div>
          {!user ? (
            <p>Please log in to view your agents.</p>
          ) : items.length === 0 ? (
            <p>You don't have any agents yet.</p>
          ) : (
            <>
              <table className="w-full mb-4">
                <thead>
                  <tr>
                    <th className="text-left">Tokens</th>
                    <th className="text-left">Balance (USD)</th>
                    <th className="text-left">Model</th>
                    <th className="text-left">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((agent) => (
                    <tr key={agent.id}>
                      <td>
                        {agent.tokenA && agent.tokenB ? (
                          <span className="inline-flex items-center gap-1">
                            <TokenDisplay token={agent.tokenA} /> /
                            <TokenDisplay token={agent.tokenB} />
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {agent.tokenA && agent.tokenB ? (
                          <AgentBalance
                            tokenA={agent.tokenA}
                            tokenB={agent.tokenB}
                          />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{agent.model || '-'}</td>
                      <td>
                        <AgentStatusLabel status={agent.status} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            className="text-blue-600 underline inline-flex"
                            to={`/agents/${agent.id}`}
                            aria-label="View agent"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            className="text-red-600"
                            onClick={() => handleDelete(agent.id)}
                            aria-label="Delete agent"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 0 && (
                <div className="flex gap-2 items-center">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </Button>
                  <span>
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}
