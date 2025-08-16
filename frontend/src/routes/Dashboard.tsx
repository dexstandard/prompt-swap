import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';

interface IndexAgent {
  id: string;
  templateId: string;
  userId: string;
  status: string;
  createdAt: number;
}

export default function Dashboard() {
  const { user } = useUser();
  const [page, setPage] = useState(1);

  const { data } = useQuery({
    queryKey: ['index-agents', page, user?.id],
    queryFn: async () => {
      const res = await api.get('/index-agents/paginated', {
        params: { page, pageSize: 10, userId: user!.id },
        headers: { 'x-user-id': user!.id },
      });
      return res.data as {
        items: IndexAgent[];
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
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
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
                <th className="text-left">Agent ID</th>
                <th className="text-left">Template</th>
                <th className="text-left">Status</th>
                <th className="text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.id}</td>
                  <td>{agent.templateId}</td>
                  <td>{agent.status}</td>
                  <td>{new Date(agent.createdAt).toLocaleString()}</td>
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
