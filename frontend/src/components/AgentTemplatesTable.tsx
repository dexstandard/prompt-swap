import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import TokenDisplay from './TokenDisplay';
import RiskDisplay from './RiskDisplay';

interface AgentTemplate {
  id: string;
  name: string;
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
  risk: string;
  reviewInterval: string;
}

export default function AgentTemplatesTable({
  onEdit,
}: {
  onEdit?: (id: string) => void;
}) {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['agent-templates', page, user?.id],
    queryFn: async () => {
      const res = await api.get('/agent-templates/paginated', {
        params: { page, pageSize: 5 },
        headers: { 'x-user-id': user!.id },
      });
      return res.data as {
        items: AgentTemplate[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="bg-white shadow-md border border-gray-200 rounded p-6 w-full">
        <h2 className="text-xl font-bold mb-4">My Templates</h2>
        <p>Please log in to view templates.</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="bg-white shadow-md border border-gray-200 rounded p-6 w-full">
      <h2 className="text-xl font-bold mb-4">My Templates</h2>
      {items.length === 0 ? (
        <p>You don't have any templates yet.</p>
      ) : (
        <>
          <table className="w-full mb-4">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Tokens</th>
                <th className="text-left">Target Allocation</th>
                <th className="text-left">Risk</th>
                <th className="text-left">Review Interval</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const reviewIntervalMap: Record<string, string> = {
                  '1h': '1 Hour',
                  '3h': '3 Hours',
                  '5h': '5 Hours',
                  '12h': '12 Hours',
                  '24h': '1 Day',
                  '3d': '3 Days',
                  '1w': '1 Week',
                };
                const reviewInterval = reviewIntervalMap[t.reviewInterval] || t.reviewInterval;
                const handleDelete = async () => {
                  if (!user) return;
                  await api.delete(`/agent-templates/${t.id}`, {
                    headers: { 'x-user-id': user.id },
                  });
                  queryClient.invalidateQueries({ queryKey: ['agent-templates'] });
                };
                return (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
                      <span className="inline-flex items-center gap-1">
                        <TokenDisplay token={t.tokenA} />/
                        <TokenDisplay token={t.tokenB} />
                      </span>
                    </td>
                    <td>{`${t.targetAllocation} / ${100 - t.targetAllocation}`}</td>
                    <td>
                      <RiskDisplay risk={t.risk} />
                    </td>
                    <td>{reviewInterval}</td>
                    <td className="flex gap-2">
                      <Link
                        to={`/agent-templates/${t.id}`}
                        className="text-blue-600 underline inline-flex"
                        aria-label="View template"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit?.(t.id)}
                        aria-label="Edit template"
                        className="text-blue-600 underline inline-flex"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        aria-label="Delete template"
                        className="text-red-600 underline inline-flex"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex gap-2 items-center">
              <button
                className="px-2 py-1 border"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                className="px-2 py-1 border"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

