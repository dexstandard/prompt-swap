import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, Trash } from 'lucide-react';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import { useAgentBalanceUsd } from '../lib/useAgentBalanceUsd';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import CreateAgentForm from '../components/forms/CreateAgentForm';
import PriceChart from '../components/forms/PriceChart';
import ErrorBoundary from '../components/ErrorBoundary';
import { useToast } from '../lib/useToast';
import Toggle from '../components/ui/Toggle';

interface Agent {
  id: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive' | 'draft';
  tokens?: { token: string }[];
  startBalanceUsd?: number | null;
}

function AgentRow({
  agent,
  onDelete,
}: {
  agent: Agent;
  onDelete: (id: string) => void;
}) {
  const { balance, isLoading } = useAgentBalanceUsd(
    agent.tokens ? agent.tokens.map((t) => t.token) : [],
  );
  const balanceText =
    balance === null ? '-' : isLoading ? 'Loading...' : `$${balance.toFixed(2)}`;
  const pnl =
    balance !== null && agent.startBalanceUsd != null
      ? balance - agent.startBalanceUsd
      : null;
  const pnlText =
    pnl === null
      ? '-'
      : isLoading
      ? 'Loading...'
      : `${pnl > 0 ? '+' : pnl < 0 ? '-' : ''}$${Math.abs(pnl).toFixed(2)}`;
  const pnlClass =
    pnl === null || isLoading
      ? ''
      : pnl <= -0.03
      ? 'text-red-600'
      : pnl >= 0.03
      ? 'text-green-600'
      : 'text-gray-600';
  const pnlTooltip =
    pnl === null || isLoading
      ? undefined
      : `PnL = $${balance!.toFixed(2)} - $${agent.startBalanceUsd!.toFixed(2)} = ${
          pnl > 0 ? '+' : pnl < 0 ? '-' : ''
        }$${Math.abs(pnl).toFixed(2)}`;
  return (
    <tr key={agent.id}>
      <td>
        {agent.tokens && agent.tokens.length ? (
          <span className="inline-flex items-center gap-1">
            {agent.tokens.map((t, i) => (
              <span key={t.token} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                <TokenDisplay token={t.token} />
              </span>
            ))}
          </span>
        ) : (
          '-'
        )}
      </td>
      <td>{balanceText}</td>
      <td className={pnlClass} title={pnlTooltip}>
        {pnlText}
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
            onClick={() => onDelete(agent.id)}
            aria-label="Delete agent"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function AgentBlock({
  agent,
  onDelete,
}: {
  agent: Agent;
  onDelete: (id: string) => void;
}) {
  const { balance, isLoading } = useAgentBalanceUsd(
    agent.tokens ? agent.tokens.map((t) => t.token) : [],
  );
  const balanceText =
    balance === null ? '-' : isLoading ? 'Loading...' : `$${balance.toFixed(2)}`;
  const pnl =
    balance !== null && agent.startBalanceUsd != null
      ? balance - agent.startBalanceUsd
      : null;
  const pnlText =
    pnl === null
      ? '-'
      : isLoading
      ? 'Loading...'
      : `${pnl > 0 ? '+' : pnl < 0 ? '-' : ''}$${Math.abs(pnl).toFixed(2)}`;
  const pnlClass =
    pnl === null || isLoading
      ? ''
      : pnl <= -0.03
      ? 'text-red-600'
      : pnl >= 0.03
      ? 'text-green-600'
      : 'text-gray-600';
  const pnlTooltip =
    pnl === null || isLoading
      ? undefined
      : `PnL = $${balance!.toFixed(2)} - $${agent.startBalanceUsd!.toFixed(2)} = ${
          pnl > 0 ? '+' : pnl < 0 ? '-' : ''
        }$${Math.abs(pnl).toFixed(2)}`;
  return (
    <div className="border rounded p-3 text-sm">
      <div className="mb-2 flex items-center gap-1 font-medium">
        {agent.tokens && agent.tokens.length ? (
          <span className="inline-flex items-center gap-1">
            {agent.tokens.map((t, i) => (
              <span key={t.token} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                <TokenDisplay token={t.token} />
              </span>
            ))}
          </span>
        ) : (
          '-'
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2 items-center">
        <div>
          <div className="text-xs text-gray-500">Balance</div>
          {balanceText}
        </div>
        <div className={pnlClass} title={pnlTooltip}>
          <div className="text-xs text-gray-500">PnL</div>
          {pnlText}
        </div>
        <div className="flex justify-end">
          <Link
            className="text-blue-600 underline inline-flex"
            to={`/agents/${agent.id}`}
            aria-label="View agent"
          >
            <Eye className="w-5 h-5" />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 items-center">
        <div>
          <div className="text-xs text-gray-500">Status</div>
          <AgentStatusLabel status={agent.status} />
        </div>
        <div>
          <div className="text-xs text-gray-500">Model</div>
          {agent.model || '-'}
        </div>
        <div className="flex justify-end">
          <button
            className="text-red-600"
            onClick={() => onDelete(agent.id)}
            aria-label="Delete agent"
          >
            <Trash className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [tokens, setTokens] = useState(['USDT', 'SOL']);
  const [onlyActive, setOnlyActive] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const handleTokensChange = useCallback((newTokens: string[]) => {
    setTokens((prev) =>
      prev[0] === newTokens[0] && prev[1] === newTokens[1] ? prev : newTokens
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

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/agents/${deleteId}`);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.show('Agent deleted', 'success');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to delete agent');
      }
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <div className="hidden md:flex flex-1">
          <ErrorBoundary>
            <PriceChart tokens={tokens} />
          </ErrorBoundary>
        </div>
        <CreateAgentForm onTokensChange={handleTokensChange} />
      </div>
      <ErrorBoundary>
        <div className="bg-white shadow-md border border-gray-200 rounded p-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">My Agents</h2>
            <Toggle
              label="Only Active"
              checked={onlyActive}
              onChange={setOnlyActive}
            />
          </div>
          {!user ? (
            <p>Please log in to view your agents.</p>
          ) : items.length === 0 ? (
            <p>You don't have any agents yet.</p>
          ) : (
            <>
              <table className="w-full mb-4 hidden md:table">
                <thead>
                  <tr>
                    <th className="text-left">Tokens</th>
                    <th className="text-left">Balance (USD)</th>
                    <th className="text-left">PnL (USD)</th>
                    <th className="text-left">Model</th>
                    <th className="text-left">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((agent) => (
                    <AgentRow
                      key={agent.id}
                      agent={agent}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
              <div className="md:hidden flex flex-col gap-2 mb-4">
                {items.map((agent) => (
                  <AgentBlock
                    key={agent.id}
                    agent={agent}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
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
    <ConfirmDialog
      open={deleteId !== null}
      message="Delete this agent?"
      confirmVariant="danger"
      onConfirm={confirmDelete}
      onCancel={() => setDeleteId(null)}
    />
    </>
  );
}
