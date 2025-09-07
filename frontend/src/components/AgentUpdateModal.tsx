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
import SelectInput from './forms/SelectInput';
import FormField from './forms/FormField';
import AiApiKeySection from './forms/AiApiKeySection';
import ExchangeApiKeySection from './forms/ExchangeApiKeySection';
import { usePrerequisites } from '../lib/usePrerequisites';

interface Props {
  agent: Agent;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export default function AgentUpdateModal({ agent, open, onClose, onUpdated }: Props) {
  const toast = useToast();
  const [data, setData] = useState({
    tokenA: agent.tokenA,
    tokenB: agent.tokenB,
    minTokenAAllocation: agent.minTokenAAllocation,
    minTokenBAllocation: agent.minTokenBAllocation,
    risk: agent.risk,
    reviewInterval: agent.reviewInterval,
    agentInstructions: agent.agentInstructions,
  });
  const tokens = [data.tokenA, data.tokenB];
  const { hasOpenAIKey, hasBinanceKey, models } = usePrerequisites(tokens);
  const [aiProvider, setAiProvider] = useState('openai');
  const [exchange, setExchange] = useState('binance');
  const [model, setModel] = useState(agent.model || '');
  const [hadModel, setHadModel] = useState(false);

  useEffect(() => {
    if (open) {
      setData({
        tokenA: agent.tokenA,
        tokenB: agent.tokenB,
        minTokenAAllocation: agent.minTokenAAllocation,
        minTokenBAllocation: agent.minTokenBAllocation,
        risk: agent.risk,
        reviewInterval: agent.reviewInterval,
        agentInstructions: agent.agentInstructions,
      });
      setModel(agent.model || '');
      if (agent.model) setHadModel(true);
    }
  }, [open, agent]);

  useEffect(() => {
    if (!hasOpenAIKey) setModel('');
  }, [hasOpenAIKey]);

  useEffect(() => {
    if (!agent.model && models.length && !model && !hadModel) {
      setModel(models[0]);
    }
  }, [models, agent.model, model, hadModel]);

  const updateMut = useMutation({
    mutationFn: async () => {
      await api.put(`/agents/${agent.id}`, {
        userId: agent.userId,
        model,
        status: agent.status,
        name: agent.name,
        ...data,
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
        toast.show('Failed to update agent');
      }
    },
  });

  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-xl font-bold mb-2">Update Agent</h2>
      <div className="max-w-2xl">
        <StrategyForm
          data={data}
          onChange={(key, value) =>
            setData((d) => {
              const updated = { ...d, [key]: value } as typeof data;
              const normalized = normalizeAllocations(
                updated.minTokenAAllocation,
                updated.minTokenBAllocation
              );
              return { ...updated, ...normalized };
            })
          }
        />
      </div>
  <AgentInstructions
    value={data.agentInstructions}
    onChange={(v) => setData((d) => ({ ...d, agentInstructions: v }))}
  />
      <div className="mt-4">
        <FormField label="AI Provider" className="w-full max-w-xs">
          <SelectInput
            id="ai-provider"
            value={aiProvider}
            onChange={setAiProvider}
            options={[{ value: 'openai', label: 'OpenAI' }]}
          />
        </FormField>
      </div>
      {!hasOpenAIKey && (
        <div className="mt-4">
          <AiApiKeySection label="OpenAI API Key" />
        </div>
      )}
      {hasOpenAIKey && (models.length || agent.model) && (
        <div className="mt-4">
          <FormField label="Model" className="w-full max-w-xs">
            <SelectInput
              id="model"
              value={model}
              onChange={setModel}
              options={
                agent.model && !models.length
                  ? [{ value: agent.model, label: agent.model }]
                  : models.map((m) => ({ value: m, label: m }))
              }
            />
          </FormField>
        </div>
      )}
      <div className="mt-4">
        <FormField label="Exchange" className="w-full max-w-xs">
          <SelectInput
            id="exchange"
            value={exchange}
            onChange={setExchange}
            options={[{ value: 'binance', label: 'Binance' }]}
          />
        </FormField>
      </div>
      {!hasBinanceKey && (
        <div className="mt-4">
          <ExchangeApiKeySection exchange="binance" label="Binance API Credentials" />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={updateMut.isPending}
          loading={updateMut.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Confirm
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        message="Update running agent?"
        onConfirm={() => {
          setConfirmOpen(false);
          updateMut.mutate();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Modal>
  );
}

