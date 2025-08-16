import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import TokenDisplay from './TokenDisplay';

interface IndexTemplate {
  id: string;
  tokenA: string;
  tokenB: string;
  risk: string;
  rebalance: string;
}

export default function IndexTemplatesTable() {
  const { user } = useUser();
  const [page, setPage] = useState(1);

  const { data } = useQuery({
    queryKey: ['index-templates', page, user?.id],
    queryFn: async () => {
      const res = await api.get('/index-templates/paginated', {
        params: { page, pageSize: 5 },
        headers: { 'x-user-id': user!.id },
      });
      return res.data as {
        items: IndexTemplate[];
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
                <th className="text-left">ID</th>
                <th className="text-left">Tokens</th>
                <th className="text-left">Risk</th>
                <th className="text-left">Rebalance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const truncatedId =
                  t.id.length > 8 ? `${t.id.slice(0, 8)}…` : t.id;
                const risk = t.risk
                  ? t.risk.charAt(0).toUpperCase() + t.risk.slice(1)
                  : '';
                return (
                  <tr key={t.id}>
                    <td className="font-mono" title={t.id}>
                      {truncatedId}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1">
                        <TokenDisplay token={t.tokenA} />/
                        <TokenDisplay token={t.tokenB} />
                      </span>
                    </td>
                    <td>{risk}</td>
                    <td>{t.rebalance}</td>
                    <td>
                      <Link
                        to={`/index-templates/${t.id}`}
                        className="text-blue-600 underline inline-flex"
                        aria-label="View template"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
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

