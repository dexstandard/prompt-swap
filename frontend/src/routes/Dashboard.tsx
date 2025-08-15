import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/user';

interface IndexItem {
  id: string;
  userId: string;
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
  risk: string;
}

export default function Dashboard() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [onlyMine, setOnlyMine] = useState(false);

  const { data } = useQuery({
    queryKey: ['indexes', page, onlyMine, user?.id],
    queryFn: async () => {
      const params: any = { page, pageSize: 10 };
      if (onlyMine && user?.id) params.userId = user.id;
      const res = await api.get('/indexes/paginated', { params });
      return res.data as {
        items: IndexItem[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      {user && (
        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => {
              setOnlyMine(e.target.checked);
              setPage(1);
            }}
          />
          Only my indexes
        </label>
      )}
      <table className="w-full mb-4">
        <thead>
          <tr>
            <th className="text-left">User</th>
            <th className="text-left">Index</th>
            <th className="text-left">Target</th>
            <th className="text-left">Risk</th>
            <th className="text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((idx) => (
            <tr key={idx.id}>
              <td>{idx.userId}</td>
              <td>{`${idx.tokenA.toUpperCase()}/${idx.tokenB.toUpperCase()}`}</td>
              <td>{`${idx.targetAllocation}%/${100 - idx.targetAllocation}%`}</td>
              <td>{idx.risk}</td>
              <td>
                <Link
                  to={`/indexes/${idx.id}`}
                  className="px-2 py-1 border inline-block"
                >
                  View
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
    </div>
  );
}
