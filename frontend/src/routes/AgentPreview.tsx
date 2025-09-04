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
  const tokens = agentData ? agentData.tokens.map((t) => t.token) : [];
  const { hasOpenAIKey, hasBinanceKey, models, balances } = usePrerequisites(tokens);
  const [model, setModel] = useState(draft?.model || '');
  useEffect(() => {
    setModel(draft?.model || '');
  }, [draft?.model]);
  useEffect(() => {
    if (!hasOpenAIKey) {
      setModel('');
    } else if (!model) {
      setModel(draft?.model || models[0] || '');
    }
  }, [hasOpenAIKey, models, draft?.model, model]);
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
        value={agentData.agentInstructions}
        onChange={(v) => setAgentData((d) => (d ? { ...d, agentInstructions: v } : d))}
      />
      {user && !hasOpenAIKey && (
        <div className="mt-4">
          <AiApiKeySection label="OpenAI API Key" />
        </div>
      )}
      {user && hasOpenAIKey && (models.length || draft?.model) && (
        <div className="mt-4">
          <h2 className="text-md font-bold">Model</h2>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="border rounded p-2"
          >
            {draft?.model && !models.length ? (
              <option value={draft.model}>{draft.model}</option>
            ) : (
              models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>
        </div>
      )}
      {user && !hasBinanceKey && (
        <div className="mt-4">
          <ExchangeApiKeySection exchange="binance" label="Binance API Credentials" />
        </div>
      )}

      <div className="mt-4">
        <WalletBalances balances={balances} hasBinanceKey={hasBinanceKey} />
        <WarningSign>
          Trading agent will use all available balance for {agentData.tokens.map((t) => t.token.toUpperCase()).join(' and ')} in
          your Binance Spot wallet. Move excess funds to futures wallet before trading.
          <br />
          <strong>DON'T MOVE FUNDS ON SPOT WALLET DURING TRADING!</strong> It will confuse the trading agent and may
          lead to unexpected results.
        </WarningSign>
        <label className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={agentData.manualRebalance}
            onChange={(e) =>
              setAgentData((d) =>
                d ? { ...d, manualRebalance: e.target.checked } : d,
              )
            }
          />
          <span>Manual Rebalancing</span>
        </label>
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
                    tokens: agentData.tokens.map((t) => ({
                      token: t.token.toUpperCase(),
                      minAllocation: t.minAllocation,
                    })),
                    risk: agentData.risk,
                    reviewInterval: agentData.reviewInterval,
                    agentInstructions: agentData.agentInstructions,
                    manualRebalance: agentData.manualRebalance,
                    status: 'draft',
                  });
                } else {
                  await api.post('/agents', {
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
            disabled={!user || !hasOpenAIKey || !hasBinanceKey || !model}
          />
        </div>
      </div>
    </div>
  );
}
