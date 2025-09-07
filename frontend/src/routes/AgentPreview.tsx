import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AgentName from '../components/AgentName';
import StrategyForm from '../components/StrategyForm';
import AgentInstructions from '../components/AgentInstructions';
import { normalizeAllocations } from '../lib/allocations';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AiApiKeySection from '../components/forms/AiApiKeySection';
import ExchangeApiKeySection from '../components/forms/ExchangeApiKeySection';
import WalletBalances from '../components/WalletBalances';
import { useToast } from '../lib/useToast';
import Button from '../components/ui/Button';
import { usePrerequisites } from '../lib/usePrerequisites';
import AgentStartButton from '../components/AgentStartButton';
import SelectInput from '../components/forms/SelectInput';
import FormField from '../components/forms/FormField';

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
}

export default function AgentPreview({ draft }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationData = location.state as AgentPreviewDetails | undefined;
  const { user } = useUser();
  const toast = useToast();
  const data = draft ?? locationData;
  const [agentData, setAgentData] = useState<AgentPreviewDetails | undefined>(data);
  useEffect(() => {
    if (data) setAgentData(data);
  }, [data]);
  const tokens = agentData ? [agentData.tokenA, agentData.tokenB] : [];
  const { hasOpenAIKey, hasBinanceKey, models, balances } = usePrerequisites(tokens);
  const [aiProvider, setAiProvider] = useState('openai');
  const [exchange, setExchange] = useState('binance');
  const [model, setModel] = useState(draft?.model || '');
  const [hadModel, setHadModel] = useState(false);
  useEffect(() => {
    setModel(draft?.model || '');
    if (draft?.model) setHadModel(true);
  }, [draft?.model]);
  useEffect(() => {
    if (!hasOpenAIKey) setModel('');
  }, [hasOpenAIKey]);
  useEffect(() => {
    if (!draft?.model && models.length && !model && !hadModel) {
      setModel(models[0]);
    }
  }, [models, draft?.model, model, hadModel]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  function WarningSign({ children }: { children: ReactNode }) {
    return (
      <div className="mt-2 p-4 text-sm text-red-600 border border-red-600 rounded bg-red-100">
        <div>{children}</div>
      </div>
    );
  }

  const isDraft = !!draft;

  if (!agentData) return <div className="p-4">No preview data</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <span>{isDraft ? 'Agent Draft:' : 'Agent Preview:'}</span>
        <AgentName
          name={agentData.name}
          onChange={(name) => setAgentData((d) => (d ? { ...d, name } : d))}
          className="text-2xl font-bold"
        />
      </h1>
      <div className="max-w-2xl">
        <StrategyForm
          data={agentData}
          onChange={(key, value) =>
            setAgentData((d) => {
              if (!d) return d;
              const updated = { ...d, [key]: value } as AgentPreviewDetails;
              const normalized = normalizeAllocations(
                updated.minTokenAAllocation,
                updated.minTokenBAllocation,
              );
              return { ...updated, ...normalized };
            })
          }
        />
      </div>
      <AgentInstructions
        value={agentData.agentInstructions}
        onChange={(v) => setAgentData((d) => (d ? { ...d, agentInstructions: v } : d))}
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
      {user && !hasOpenAIKey && (
        <div className="mt-4">
          <AiApiKeySection label="OpenAI API Key" />
        </div>
      )}
      {user && hasOpenAIKey && (models.length || draft?.model) && (
        <div className="mt-4">
          <FormField label="Model" className="w-full max-w-xs">
            <SelectInput
              id="model"
              value={model}
              onChange={setModel}
              options={
                draft?.model && !models.length
                  ? [{ value: draft.model, label: draft.model }]
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
      {user && !hasBinanceKey && (
        <div className="mt-4">
          <ExchangeApiKeySection exchange="binance" label="Binance API Credentials" />
        </div>
      )}

      <div className="mt-4">
        <WalletBalances balances={balances} hasBinanceKey={hasBinanceKey} />
        <WarningSign>
          Trading agent will use all available balance for {agentData.tokenA.toUpperCase()} and {agentData.tokenB.toUpperCase()} in
          your Binance Spot wallet. Move excess funds to futures wallet before trading.
          <br />
          <strong>DON'T MOVE FUNDS ON SPOT WALLET DURING TRADING!</strong> It will confuse the trading agent and may
          lead to unexpected results.
        </WarningSign>
        {!user && (
          <p className="text-sm text-gray-600 mb-2 mt-4">Log in to continue</p>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            disabled={isSavingDraft || !user}
            loading={isSavingDraft}
            onClick={async () => {
              if (!user) return;
              setIsSavingDraft(true);
              try {
                if (isDraft) {
                  await api.put(`/agents/${draft!.id}`, {
                    userId: draft!.userId,
                    model,
                    name: agentData.name,
                    tokenA: agentData.tokenA,
                    tokenB: agentData.tokenB,
                    minTokenAAllocation: agentData.minTokenAAllocation,
                    minTokenBAllocation: agentData.minTokenBAllocation,
                    risk: agentData.risk,
                    reviewInterval: agentData.reviewInterval,
                    agentInstructions: agentData.agentInstructions,
                    status: 'draft',
                  });
                } else {
                  await api.post('/agents', {
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
                    status: 'draft',
                  });
                }
                setIsSavingDraft(false);
                toast.show('Draft saved successfully', 'success');
                navigate('/');
              } catch (err) {
                setIsSavingDraft(false);
                if (axios.isAxiosError(err) && err.response?.data?.error) {
                  toast.show(err.response.data.error);
                } else {
                  toast.show('Failed to save draft');
                }
              }
            }}
          >
            {isDraft ? 'Update Draft' : 'Save Draft'}
          </Button>
          <AgentStartButton
            draft={draft}
            agentData={agentData}
            model={model}
            disabled={
              !user || !hasOpenAIKey || !hasBinanceKey || (!model && !models.length)
            }
          />
        </div>
      </div>
    </div>
  );
}
