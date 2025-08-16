import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/user';

interface IndexAgentItem {
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
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await api.get('/index-agents/paginated', {
        params: { page, pageSize: 10 },
        headers: { 'x-user-id': user!.id },
      });
      return res.data as {
        items: IndexAgentItem[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
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

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      {data && data.items.length === 0 ? (
        <p>You don't have running agents yet.</p>
      ) : (
        <>
          <table className="w-full mb-4">
            <thead>
              <tr>
                <th className="text-left">Agent</th>
                <th className="text-left">Template</th>
                <th className="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.id}</td>
                  <td>{agent.templateId}</td>
                  <td>{agent.status}</td>
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
