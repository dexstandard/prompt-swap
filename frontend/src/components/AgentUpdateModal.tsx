import { useState, useEffect } from 'react';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/axios';
import type { Agent } from '../lib/useAgentData';
import { useToast } from '../lib/useToast';
import Button from './ui/Button';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import StrategyForm from './StrategyForm';
import AgentInstructions from './AgentInstructions';
import { normalizeAllocations } from '../lib/allocations';
import ApiKeyProviderSelector from './forms/ApiKeyProviderSelector';
import WalletBalances from './WalletBalances';
import { usePrerequisites } from '../lib/usePrerequisites';
import SelectInput from './forms/SelectInput';
import { useTranslation } from '../lib/i18n';

interface Props {
  agent: Agent;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export default function AgentUpdateModal({ agent, open, onClose, onUpdated }: Props) {
  const toast = useToast();
  const t = useTranslation();
  const [data, setData] = useState({
    tokens: agent.tokens,
    risk: agent.risk,
    reviewInterval: agent.reviewInterval,
    agentInstructions: agent.agentInstructions,
  });

  const tokens = data.tokens.map((t) => t.token);
  const { hasOpenAIKey, hasBinanceKey, models, balances } = usePrerequisites(tokens);
  const [model, setModel] = useState(agent.model || '');
  const [aiProvider, setAiProvider] = useState('openai');
  const [exchangeProvider, setExchangeProvider] = useState('binance');

  useEffect(() => {
    if (open) {
      setData({
        tokens: agent.tokens,
        risk: agent.risk,
        reviewInterval: agent.reviewInterval,
        agentInstructions: agent.agentInstructions,
      });
      setModel(agent.model || '');
    }
  }, [open, agent]);

  useEffect(() => {
    if (!hasOpenAIKey) {
      setModel('');
    } else if (!model) {
      setModel(agent.model || models[0] || '');
    }
  }, [hasOpenAIKey, models, agent.model, model]);

  const updateMut = useMutation({
    mutationFn: async () => {
      await api.put(`/portfolio-workflows/${agent.id}`, {
        userId: agent.userId,
        model,
        status: agent.status,
        name: agent.name,
        tokens: data.tokens.map((t) => ({
          token: t.token.toUpperCase(),
          minAllocation: t.minAllocation,
        })),
        risk: data.risk,
        reviewInterval: data.reviewInterval,
        agentInstructions: data.agentInstructions,
        manualRebalance: agent.manualRebalance,
        useEarn: agent.useEarn,
      });
    },
    onSuccess: () => {
      onClose();
      onUpdated();
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.show(err.response.data.error);
      } else {
        toast.show(t('failed_update_agent'));
      }
    },
  });

  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-xl font-bold mb-2">{t('update_agent')}</h2>
      <div className="max-w-2xl">
        <StrategyForm
          data={data}
          onChange={(key, value) =>
            setData((d) => {
              const updated = { ...d, [key]: value } as typeof data;
              const norm = normalizeAllocations(
                updated.tokens[0].minAllocation,
                updated.tokens[1].minAllocation,
              );
              const tokens = [
                { ...updated.tokens[0], minAllocation: norm.minTokenAAllocation },
                { ...updated.tokens[1], minAllocation: norm.minTokenBAllocation },
              ];
              return { ...updated, tokens };
            })
          }
        />
      </div>
      <AgentInstructions
        value={data.agentInstructions}
        onChange={(v) => setData((d) => ({ ...d, agentInstructions: v }))}
      />
      <div className="mt-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <ApiKeyProviderSelector
              type="ai"
              label={t('ai_provider')}
              value={aiProvider}
              onChange={setAiProvider}
            />
            {hasOpenAIKey && (models.length || agent.model) && (
              <div className="mt-2">
                <h2 className="text-md font-bold">{t('model')}</h2>
                <SelectInput
                  id="update-model"
                  value={model}
                  onChange={setModel}
                  options={
                    agent.model && !models.length
                      ? [{ value: agent.model, label: agent.model }]
                      : models.map((m) => ({ value: m, label: m }))
                  }
                />
              </div>
            )}
          </div>
          <div>
            <ApiKeyProviderSelector
              type="exchange"
              label={t('exchange')}
              value={exchangeProvider}
              onChange={setExchangeProvider}
            />
            <div className="mt-2">
              <WalletBalances balances={balances} hasBinanceKey={hasBinanceKey} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button
          disabled={updateMut.isPending}
          loading={updateMut.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {t('confirm')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        message={
          agent.status === 'active'
            ? t('update_running_agent_prompt')
            : t('update_agent_prompt')
        }
        onConfirm={() => {
          setConfirmOpen(false);
          updateMut.mutate();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Modal>
  );
}

