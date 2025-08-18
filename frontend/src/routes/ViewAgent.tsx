import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AgentStatusLabel from '../components/AgentStatusLabel';
import TokenDisplay from '../components/TokenDisplay';
import AgentBalance from '../components/AgentBalance';
import Button from '../components/ui/Button';

interface Agent {
  id: string;
  userId: string;
  model: string | null;
  status: 'active' | 'inactive';
  createdAt: number;
  name?: string | null;
  tokenA?: string | null;
  tokenB?: string | null;
  targetAllocation?: number | null;
  minTokenAAllocation?: number | null;
  minTokenBAllocation?: number | null;
  risk?: string | null;
  reviewInterval?: string | null;
  agentInstructions?: string | null;
}

export default function ViewAgent() {
  const { id } = useParams();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['agent', id, user?.id],
    queryFn: async () => {
      const res = await api.get(`/agents/${id}`);
      return res.data as Agent;
    },
    enabled: !!id && !!user,
  });
  const [form, setForm] = useState<Agent | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!data || !form) return <div className="p-4">Loading...</div>;

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numFields = ['targetAllocation', 'minTokenAAllocation', 'minTokenBAllocation'];
    const val = numFields.includes(name) ? (value === '' ? null : Number(value)) : value;
    setForm((f) => ({ ...f!, [name]: val }));
  };

  const save = async () => {
    await api.put(`/agents/${id}`, { ...form, userId: user!.id, status: 'inactive' });
    queryClient.invalidateQueries({ queryKey: ['agent', id, user?.id] });
  };

  const launch = async () => {
    await api.put(`/agents/${id}`, { ...form, userId: user!.id, status: 'active' });
    queryClient.invalidateQueries({ queryKey: ['agent', id, user?.id] });
  };

  return (
    <div className="p-4 space-y-2">
      <h1 className="text-2xl font-bold mb-4">Agent</h1>
      <p>
        <strong>Status:</strong> <AgentStatusLabel status={form.status} />
      </p>
      {form.status === 'inactive' ? (
        <div className="space-y-2">
          <label className="block">
            <span>Name</span>
            <input
              name="name"
              value={form.name || ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Model</span>
            <input
              name="model"
              value={form.model || ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Token A</span>
            <input
              name="tokenA"
              value={form.tokenA || ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Token B</span>
            <input
              name="tokenB"
              value={form.tokenB || ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Target Allocation</span>
            <input
              name="targetAllocation"
              type="number"
              value={form.targetAllocation ?? ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Min Token A Allocation</span>
            <input
              name="minTokenAAllocation"
              type="number"
              value={form.minTokenAAllocation ?? ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Min Token B Allocation</span>
            <input
              name="minTokenBAllocation"
              type="number"
              value={form.minTokenBAllocation ?? ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Risk</span>
            <input
              name="risk"
              value={form.risk || ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Review Interval</span>
            <input
              name="reviewInterval"
              value={form.reviewInterval || ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <label className="block">
            <span>Instructions</span>
            <textarea
              name="agentInstructions"
              value={form.agentInstructions || ''}
              onChange={onChange}
              className="border p-1 w-full"
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" onClick={save}>
              Save Draft
            </Button>
            <Button type="button" onClick={launch}>
              Launch
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p>
            <strong>Name:</strong> {form.name}
          </p>
          <p>
            <strong>Model:</strong> {form.model}
          </p>
          {form.tokenA && form.tokenB && (
            <p className="flex items-center gap-1">
              <strong>Tokens:</strong>
              <TokenDisplay token={form.tokenA} />/
              <TokenDisplay token={form.tokenB} />
            </p>
          )}
          {form.tokenA && form.tokenB && (
            <p>
              <strong>Balance (USD):</strong>{' '}
              <AgentBalance tokenA={form.tokenA} tokenB={form.tokenB} />
            </p>
          )}
          <p>
            <strong>Created:</strong> {new Date(form.createdAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
