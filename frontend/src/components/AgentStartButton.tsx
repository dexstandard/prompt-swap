import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import { useToast } from '../lib/useToast';
import Button from './ui/Button';
import ConfirmDialog from './ui/ConfirmDialog';

interface AgentPreviewDetails {
  name: string;
  tokens: { token: string; minAllocation: number }[];
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
  manualRebalance: boolean;
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function startAgent() {
    if (!user) return;
    if (!model) {
      toast.show('Model is required');
      return;
    }
    setConfirmOpen(false);
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
          tokens: agentData.tokens.map((t) => ({
            token: t.token.toUpperCase(),
            minAllocation: t.minAllocation,
          })),
          risk: agentData.risk,
          reviewInterval: agentData.reviewInterval,
          agentInstructions: agentData.agentInstructions,
          manualRebalance: agentData.manualRebalance,
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
    <>
      <Button
        disabled={disabled || isCreating}
        loading={isCreating}
        onClick={() => setConfirmOpen(true)}
      >
        Start Agent
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        message="Start agent with current settings?"
        onConfirm={startAgent}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

