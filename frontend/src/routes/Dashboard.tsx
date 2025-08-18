import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import AgentBalance from '../components/AgentBalance';
import Button from '../components/ui/Button';
import AgentTemplateForm from '../components/forms/AgentTemplateForm';
import PriceChart from '../components/forms/PriceChart';
import ErrorBoundary from '../components/ErrorBoundary';

interface Agent {
  id: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive';
  tokenA: string;
  tokenB: string;
  risk: string;
}

export default function Dashboard() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [tokens, setTokens] = useState({ tokenA: 'USDT', tokenB: 'SOL' });

  const handleTokensChange = useCallback((a: string, b: string) => {
    setTokens((prev) =>
      prev.tokenA === a && prev.tokenB === b ? prev : { tokenA: a, tokenB: b }
    );
  }, []);

  const { data } = useQuery({
    queryKey: ['agents', page, user?.id],
    queryFn: async () => {
      const res = await api.get('/agents/paginated', {
        params: { page, pageSize: 10, userId: user!.id },
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

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex gap-3 items-stretch">
        <ErrorBoundary>
          <PriceChart tokenA={tokens.tokenA} tokenB={tokens.tokenB} />
        </ErrorBoundary>
        <AgentTemplateForm onTokensChange={handleTokensChange} />
      </div>
      <ErrorBoundary>
        <div className="bg-white shadow-md border border-gray-200 rounded p-6 w-full">
          <h2 className="text-xl font-bold mb-4">My Agents</h2>
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
                        <span className="inline-flex items-center gap-1">
                          <TokenDisplay token={agent.tokenA} />/
                          <TokenDisplay token={agent.tokenB} />
                        </span>
                      </td>
                      <td>
                        <AgentBalance tokenA={agent.tokenA} tokenB={agent.tokenB} />
                      </td>
                      <td>{agent.model}</td>
                      <td>
                        <AgentStatusLabel status={agent.status} />
                      </td>
                      <td>
                        <Link
                          className="text-blue-600 underline inline-flex"
                          to={`/agents/${agent.id}`}
                          aria-label="View agent"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
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
