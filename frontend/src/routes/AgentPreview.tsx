import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import RiskDisplay from '../components/RiskDisplay';
import TokenDisplay from '../components/TokenDisplay';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import AiApiKeySection from '../components/forms/AiApiKeySection';
import ExchangeApiKeySection from '../components/forms/ExchangeApiKeySection';
import WalletBalances from '../components/WalletBalances';
import { useToast } from '../components/Toast';
import Button from '../components/ui/Button';

interface AgentPreviewDetails {
  name: string;
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
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
  const data = draft ?? locationData;
  const { user } = useUser();
  const toast = useToast();
  if (!data) return <div className="p-4">No preview data</div>;
  const aiKeyQuery = useQuery<string | null>({
    queryKey: ['ai-key', user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${user!.id}/ai-key`);
        return res.data.key as string;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });
  const hasOpenAIKey = !!aiKeyQuery.data;
  const binanceKeyQuery = useQuery<string | null>({
    queryKey: ['binance-key', user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const res = await api.get(`/users/${user!.id}/binance-key`);
        return res.data.key as string;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });
  const hasBinanceKey = !!binanceKeyQuery.data;
  const modelsQuery = useQuery<string[]>({
    queryKey: ['openai-models', user?.id],
    enabled: !!user && hasOpenAIKey && (!draft || !draft.model),
    queryFn: async () => {
      const res = await api.get(`/users/${user!.id}/models`);
      return res.data.models as string[];
    },
  });
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
    if (!draft?.model && modelsQuery.data && modelsQuery.data.length && !model && !hadModel) {
      setModel(modelsQuery.data[0]);
    }
  }, [modelsQuery.data, draft?.model, model, hadModel]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const reviewIntervalMap: Record<string, string> = {
    '1h': '1 Hour',
    '3h': '3 Hours',
    '5h': '5 Hours',
    '12h': '12 Hours',
    '24h': '1 Day',
    '3d': '3 Days',
    '1w': '1 Week',
  };
  const reviewIntervalLabel = reviewIntervalMap[data.reviewInterval] ?? data.reviewInterval;

  function WarningSign({ children }: { children: ReactNode }) {
    return (
      <div className="mt-2 p-4 text-sm text-red-600 border border-red-600 rounded bg-red-100">
        <div>{children}</div>
      </div>
    );
  }

  const isDraft = !!draft;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">
        {isDraft ? 'Agent Draft' : 'Agent Preview'}
      </h1>
      <h2 className="text-xl font-bold mb-2">{data.name}</h2>
      <p className="flex items-center gap-1">
        <strong>Tokens:</strong>
        <TokenDisplay token={data.tokenA} />
        <span>/</span>
        <TokenDisplay token={data.tokenB} />
      </p>
      <p>
        <strong>Target Allocation:</strong> {data.targetAllocation} / {100 - data.targetAllocation}
      </p>
      <p>
        <strong>Minimum {data.tokenA.toUpperCase()} Allocation:</strong> {data.minTokenAAllocation}%
      </p>
      <p>
        <strong>Minimum {data.tokenB.toUpperCase()} Allocation:</strong> {data.minTokenBAllocation}%
      </p>
      <p className="flex items-center gap-1">
        <strong>Risk Tolerance:</strong> <RiskDisplay risk={data.risk} />
      </p>
      <p>
        <strong>Review Interval:</strong> {reviewIntervalLabel}
      </p>
      <div className="mt-4">
        <h2 className="text-xl font-bold">Trading Agent Instructions</h2>
        <pre className="whitespace-pre-wrap">{data.agentInstructions}</pre>
      </div>
      {user && !hasOpenAIKey && (
        <div className="mt-4">
          <AiApiKeySection label="OpenAI API Key" />
        </div>
      )}
      {user && hasOpenAIKey && (modelsQuery.data?.length || draft?.model) && (
        <div className="mt-4">
          <h2 className="text-md font-bold">Model</h2>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="border rounded p-2"
          >
            {draft?.model && !modelsQuery.data?.length ? (
              <option value={draft.model}>{draft.model}</option>
            ) : (
              modelsQuery.data?.map((m) => (
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
        <WalletBalances tokens={[data.tokenA, data.tokenB]} />
        <WarningSign>
          Trading agent will use all available balance for {data.tokenA.toUpperCase()} and {data.tokenB.toUpperCase()} in
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
                    name: data.name,
                    tokenA: data.tokenA,
                    tokenB: data.tokenB,
                    targetAllocation: data.targetAllocation,
                    minTokenAAllocation: data.minTokenAAllocation,
                    minTokenBAllocation: data.minTokenBAllocation,
                    risk: data.risk,
                    reviewInterval: data.reviewInterval,
                    agentInstructions: data.agentInstructions,
                    status: 'draft',
                  });
                  navigate(`/agents/${draft!.id}`);
                } else {
                  const res = await api.post('/agents', {
                    userId: user.id,
                    model,
                    name: data.name,
                    tokenA: data.tokenA,
                    tokenB: data.tokenB,
                    targetAllocation: data.targetAllocation,
                    minTokenAAllocation: data.minTokenAAllocation,
                    minTokenBAllocation: data.minTokenBAllocation,
                    risk: data.risk,
                    reviewInterval: data.reviewInterval,
                    agentInstructions: data.agentInstructions,
                    status: 'draft',
                  });
                  navigate(`/agents/${res.data.id}`);
                }
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
            Save Draft
          </Button>
          <Button
            disabled={
              isCreating ||
              !user ||
              !hasOpenAIKey ||
              !hasBinanceKey ||
              (!model && !modelsQuery.data?.length)
            }
            loading={isCreating}
            onClick={async () => {
              if (!user) return;
              setIsCreating(true);
              try {
                if (isDraft) {
                  await api.post(`/agents/${draft!.id}/start`);
                  navigate(`/agents/${draft!.id}`);
                } else {
                  const res = await api.post('/agents', {
                    userId: user.id,
                    model,
                    name: data.name,
                    tokenA: data.tokenA,
                    tokenB: data.tokenB,
                    targetAllocation: data.targetAllocation,
                    minTokenAAllocation: data.minTokenAAllocation,
                    minTokenBAllocation: data.minTokenBAllocation,
                    risk: data.risk,
                    reviewInterval: data.reviewInterval,
                    agentInstructions: data.agentInstructions,
                    status: 'active',
                  });
                  navigate(`/agents/${res.data.id}`);
                }
              } catch (err) {
                setIsCreating(false);
                if (axios.isAxiosError(err) && err.response?.data?.error) {
                  toast.show(err.response.data.error);
                } else {
                  toast.show('Failed to start agent');
                }
              }
            }}
          >
            Start Agent
          </Button>
        </div>
      </div>
    </div>
  );
}
