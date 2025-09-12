import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import { useToast } from '../lib/useToast';
import { useTranslation } from '../lib/i18n';
import Button from './ui/Button';
import ConfirmDialog from './ui/ConfirmDialog';
import type { PortfolioReviewFormValues } from '../lib/constants';

interface AgentPreviewDetails {
  name: string;
  tokens: { token: string; minAllocation: number }[];
  risk: PortfolioReviewFormValues['risk'];
  reviewInterval: PortfolioReviewFormValues['reviewInterval'];
  agentInstructions: string;
  manualRebalance: boolean;
  useEarn: boolean;
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
  const t = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function startAgent() {
    if (!user) return;
    if (!model) {
      toast.show(t('model_required'));
      return;
    }
    setConfirmOpen(false);
    setIsCreating(true);
    try {
      if (draft) {
        await api.post(`/portfolio-workflows/${draft.id}/start`);
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        toast.show(t('agent_started_success'), 'success');
        navigate('/');
      } else {
        const res = await api.post('/portfolio-workflows', {
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
          useEarn: agentData.useEarn,
          status: 'active',
        });
        navigate(`/portfolio-workflows/${res.data.id}`);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show(t('failed_start_agent'));
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
        {t('start_agent')}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        message={t('start_agent_confirm')}
        onConfirm={startAgent}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

