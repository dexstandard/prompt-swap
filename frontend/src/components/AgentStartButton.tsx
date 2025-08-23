import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import { useToast } from './Toast';
import Button from './ui/Button';

interface AgentPreviewDetails {
  name: string;
  tokenA: string;
  tokenB: string;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
}

interface AgentDraft extends AgentPreviewDetails {
  id: string;
  userId: string;
  model: string | null;
}

interface Props {
  draft?: AgentDraft;
  agentData: AgentPreviewDetails;
  model: string;
  disabled: boolean;
}

export default function AgentStartButton({
  draft,
  agentData,
  model,
  disabled,
}: Props) {
  const { user } = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  async function handleStart() {
    if (!user) return;
    if (!window.confirm('Start agent with current settings?')) return;
    setIsCreating(true);
    try {
      if (draft) {
        await api.post(`/agents/${draft.id}/start`);
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        toast.show('Agent started successfully', 'success');
        navigate('/');
      } else {
        const res = await api.post('/agents', {
          userId: user.id,
          model,
          name: agentData.name,
          tokenA: agentData.tokenA,
          tokenB: agentData.tokenB,
          minTokenAAllocation: agentData.minTokenAAllocation,
          minTokenBAllocation: agentData.minTokenBAllocation,
          risk: agentData.risk,
          reviewInterval: agentData.reviewInterval,
          agentInstructions: agentData.agentInstructions,
          status: 'active',
        });
        navigate(`/agents/${res.data.id}`);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show('Failed to start agent');
      }
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Button disabled={disabled || isCreating} loading={isCreating} onClick={handleStart}>
      Start Agent
    </Button>
  );
}

