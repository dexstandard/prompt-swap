import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
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
    risk: string;
  };
}

export default function Dashboard() {
  const { user } = useUser();
  const [page, setPage] = useState(1);

  const { data } = useQuery({
    queryKey: ['agents', page, user?.id],
    queryFn: async () => {
      const res = await api.get('/agents/paginated', {
        params: { page, pageSize: 10, userId: user!.id },
        headers: { 'x-user-id': user!.id },
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

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">My Agents</h1>
        <p>Please log in to view your agents.</p>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const items = data?.items ?? [];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">My Agents</h1>
      {items.length === 0 ? (
        <p>You don't have any agents yet.</p>
      ) : (
        <>
          <table className="w-full mb-4">
            <thead>
              <tr>
                <th className="text-left">Created</th>
                <th className="text-left">Pair</th>
                <th className="text-left">Model</th>
                <th className="text-left">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((agent) => (
                <tr key={agent.id}>
                  <td>{new Date(agent.createdAt).toLocaleString()}</td>
                  <td>
                    {agent.template ? (
                      <span className="inline-flex items-center gap-1">
                        <TokenDisplay token={agent.template.tokenA} /> /
                        <TokenDisplay token={agent.template.tokenB} />
                      </span>
                    ) : (
                      '-'
                    )}
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
