import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import { useAgentBalanceUsd } from '../components/AgentBalance';
import Button from '../components/ui/Button';
import { useToast } from '../components/Toast';
import AgentPreview from './AgentPreview';
import StrategyForm from '../components/StrategyForm';
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import ExecLogItem, { type ExecLog } from '../components/ExecLogItem';
import Modal from '../components/ui/Modal';
import AgentInstructions from '../components/AgentInstructions';
import { normalizeAllocations } from '../lib/allocations';
import FormattedDate from '../components/ui/FormattedDate';

interface Agent {
  id: string;
  userId: string;
  model: string;
  status: 'active' | 'inactive' | 'draft';
  createdAt: number;
  name: string;
  tokenA: string;
  tokenB: string;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
  startBalanceUsd: number | null;
}

export default function AgentView() {
  const { id } = useParams();
  const { user } = useUser();
  const { data } = useQuery({
    queryKey: ['agent', id, user?.id],
    queryFn: async () => {
      const res = await api.get(`/agents/${id}`);
      return res.data as Agent;
    },
    enabled: !!id && !!user,
  });
  const queryClient = useQueryClient();
  const toast = useToast();

  const startMut = useMutation({
    mutationFn: async () => {
      await api.post(`/agents/${id}/start`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['agent', id, user?.id] }),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to start agent');
      }
    },
  });
  const stopMut = useMutation({
    mutationFn: async () => {
      await api.post(`/agents/${id}/stop`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['agent', id, user?.id] }),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to stop agent');
      }
    },
  });
  const reviewMut = useMutation({
    mutationFn: async (agentId: string) => {
      await api.post(`/agents/${agentId}/review`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['agent-log', id] }),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to run review');
      }
    },
  });

  const { balance, isLoading: balLoading } = useAgentBalanceUsd(
    data?.tokenA,
    data?.tokenB,
  );
  const balanceText =
    balance === null ? '-' : balLoading ? 'Loading...' : `$${balance.toFixed(2)}`;
  const pnl =
    balance !== null && data?.startBalanceUsd != null
      ? balance - data.startBalanceUsd
      : null;
  const pnlText =
    pnl === null
      ? '-'
      : balLoading
      ? 'Loading...'
      : `${pnl > 0 ? '+' : pnl < 0 ? '-' : ''}$${Math.abs(pnl).toFixed(2)}`;
  const pnlClass =
    pnl === null || balLoading
      ? ''
      : pnl <= -0.03
      ? 'text-red-600'
      : pnl >= 0.03
      ? 'text-green-600'
      : 'text-gray-600';
  const pnlTooltip =
    pnl === null || balLoading
      ? undefined
      : `PnL = $${balance!.toFixed(2)} - $${data!.startBalanceUsd!.toFixed(2)} = ${
          pnl > 0 ? '+' : pnl < 0 ? '-' : ''
        }$${Math.abs(pnl).toFixed(2)}`;

  const [showStrategy, setShowStrategy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateData, setUpdateData] = useState({
    tokenA: '',
    tokenB: '',
    minTokenAAllocation: 0,
    minTokenBAllocation: 0,
    risk: '',
    reviewInterval: '',
    agentInstructions: '',
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!id) return;
      await api.put(`/agents/${id}`, {
        userId: data!.userId,
        model: data!.model,
        status: data!.status,
        name: data!.name,
        ...updateData,
      });
    },
    onSuccess: () => {
      setShowUpdate(false);
      queryClient.invalidateQueries({ queryKey: ['agent', id, user?.id] });
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to update agent');
      }
    },
  });

  const [logPage, setLogPage] = useState(1);
  const { data: logData } = useQuery({
    queryKey: ['agent-log', id, logPage, user?.id],
    queryFn: async () => {
      const res = await api.get(`/agents/${id}/exec-log`, {
        params: { page: logPage, pageSize: 10 },
      });
      return res.data as {
        items: ExecLog[];
        total: number;
        page: number;
        pageSize: number;
      };
    },
    enabled: !!id && !!user,
  });

  if (!data) return <div className="p-4">Loading...</div>;
  if (data.status === 'draft') return <AgentPreview draft={data} />;

  const isActive = data.status === 'active';
  const strategyData = {
    tokenA: data.tokenA,
    tokenB: data.tokenB,
    minTokenAAllocation: data.minTokenAAllocation,
    minTokenBAllocation: data.minTokenBAllocation,
    risk: data.risk,
    reviewInterval: data.reviewInterval,
  };

  return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <span>Agent:</span> <span>{data.name}</span>
        </h1>
        <p className="mt-2">
          <strong>Created:</strong> <FormattedDate date={data.createdAt} />
        </p>
        <p className="mt-2">
          <strong>Status:</strong> <AgentStatusLabel status={data.status}/>
        </p>
        <p className="flex items-center gap-1 mt-2">
          <strong>Tokens:</strong>
          <TokenDisplay token={data.tokenA}/>
          <span>/</span>
          <TokenDisplay token={data.tokenB}/>
        </p>
        <div className="mt-2">
          <div
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => setShowStrategy((s) => !s)}
          >
            <h2 className="text-l font-bold">Strategy</h2>
            {showStrategy ? (
                <ChevronDown className="w-4 h-4"/>
            ) : (
                <ChevronRight className="w-4 h-4"/>
            )}
          </div>
          {showStrategy && (
              <div className="mt-2 max-w-2xl">
                <StrategyForm data={strategyData} onChange={() => {
                }} disabled/>
              </div>
          )}
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-1">
            <h2 className="text-l font-bold">Trading Instructions</h2>
            {showPrompt ? (
                <EyeOff
                    className="w-4 h-4 cursor-pointer"
                    onClick={() => setShowPrompt(false)}
                />
            ) : (
                <Eye
                    className="w-4 h-4 cursor-pointer"
                    onClick={() => setShowPrompt(true)}
                />
            )}
          </div>
          {showPrompt && (
              <pre className="whitespace-pre-wrap mt-2">
            {data.agentInstructions}
          </pre>
          )}
        </div>
        <p className="mt-2">
          <strong>Balance (USD):</strong> {balanceText}
          <span className="ml-4">
            <strong>PnL (USD):</strong>{' '}
            <span className={pnlClass} title={pnlTooltip}>
              {pnlText}
            </span>
          </span>
        </p>
        {isActive ? (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => {
                setUpdateData({
                  tokenA: data.tokenA,
                  tokenB: data.tokenB,

                  minTokenAAllocation: data.minTokenAAllocation,
                  minTokenBAllocation: data.minTokenBAllocation,
                  risk: data.risk,
                  reviewInterval: data.reviewInterval,
                  agentInstructions: data.agentInstructions,
                });
                setShowUpdate(true);
              }}>
                Update Agent
              </Button>
              <Button
                  disabled={stopMut.isPending}
                  loading={stopMut.isPending}
                  onClick={() => stopMut.mutate()}
              >
                Stop Agent
              </Button>
              <Button
                  disabled={reviewMut.isPending}
                  loading={reviewMut.isPending}
                  onClick={() => id && reviewMut.mutate(id)}
              >
                Run Review
              </Button>
            </div>
        ) : (
            <Button
                className="mt-4"
                disabled={startMut.isPending}
                loading={startMut.isPending}
                onClick={() => startMut.mutate()}
            >
              Start Agent
            </Button>
        )}
        {logData && (
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-2">Execution Log</h2>
              {logData.items.length === 0 ? (
                  <p>No logs yet.</p>
              ) : (
                  <>
                    <table className="w-full mb-2 table-fixed">
                      <colgroup>
                        <col className="w-40" />
                        <col />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="text-left">Time</th>
                          <th className="text-left">Log</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logData.items.map((log) => (
                          <tr key={log.id}>
                            <td className="align-top pr-2 whitespace-nowrap">
                              <FormattedDate date={log.createdAt} />
                            </td>
                            <td className="w-full">
                              <ExecLogItem log={log} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center gap-2">
                      <Button
                          disabled={logPage === 1}
                          onClick={() => setLogPage((p) => Math.max(p - 1, 1))}
                      >
                        Prev
                      </Button>
                      <span>
                  Page {logData.page} of{' '}
                        {Math.ceil(logData.total / logData.pageSize)}
                </span>
                      <Button
                          disabled={logData.page * logData.pageSize >= logData.total}
                          onClick={() => setLogPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </>
              )}
            </div>
        )}
        <Modal open={showUpdate} onClose={() => setShowUpdate(false)}>
          <h2 className="text-xl font-bold mb-2">Update Agent</h2>
          <div className="max-w-2xl">
            <StrategyForm
                data={updateData}
                onChange={(key, value) =>
                    setUpdateData((d) => {
                      const updated = {...d, [key]: value};
                      const normalized = normalizeAllocations(

                          updated.minTokenAAllocation,
                          updated.minTokenBAllocation,
                      );
                      return {...updated, ...normalized};
                    })
                }
            />
          </div>
          <AgentInstructions
              value={updateData.agentInstructions}
              onChange={(v) =>
                  setUpdateData((d) => ({...d, agentInstructions: v}))
              }
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setShowUpdate(false)}>Cancel</Button>
            <Button
                disabled={updateMut.isPending}
                loading={updateMut.isPending}
                onClick={() => {
                  if (window.confirm('Update running agent?')) updateMut.mutate();
                }}
            >
              Confirm
            </Button>
          </div>
        </Modal>
      </div>
  );
}

