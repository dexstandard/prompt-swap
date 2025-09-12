import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../lib/i18n';
import AgentName from '../components/AgentName';
import AgentInstructions from '../components/AgentInstructions';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import ApiKeyProviderSelector from '../components/forms/ApiKeyProviderSelector';
import WalletBalances from '../components/WalletBalances';
import { useToast } from '../lib/useToast';
import Button from '../components/ui/Button';
import { usePrerequisites } from '../lib/usePrerequisites';
import AgentStartButton from '../components/AgentStartButton';
import SelectInput from '../components/forms/SelectInput';

interface WorkflowPreviewDetails {
  name: string;
  tokens: { token: string; minAllocation: number }[];
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
  manualRebalance: boolean;
}

interface WorkflowDraft extends WorkflowPreviewDetails {
  id: string;
  userId: string;
  model: string | null;
}

interface Props {
  draft?: WorkflowDraft;
}

export default function PortfolioWorkflowPreview({ draft }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationData = location.state as WorkflowPreviewDetails | undefined;
  const { user } = useUser();
  const toast = useToast();
  const t = useTranslation();
  const data = draft ?? locationData;
  const [workflowData, setWorkflowData] =
    useState<WorkflowPreviewDetails | undefined>(data);
  useEffect(() => {
    if (data) setWorkflowData(data);
  }, [data]);
  const tokens = workflowData ? workflowData.tokens.map((t) => t.token) : [];
  const { hasOpenAIKey, hasBinanceKey, models, balances } = usePrerequisites(tokens);
  const [model, setModel] = useState(draft?.model || '');
  const [aiProvider, setAiProvider] = useState('openai');
  const [exchangeProvider, setExchangeProvider] = useState('binance');
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

  if (!workflowData) return <div className="p-4">{t('no_preview_data')}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <span>{isDraft ? t('agent_draft') : t('agent_preview')}:</span>
        <AgentName
          name={workflowData.name}
          onChange={(name) =>
            setWorkflowData((d) => (d ? { ...d, name } : d))
          }
          className="text-2xl font-bold"
        />
      </h1>
      <div className="max-w-2xl">
        <h2 className="text-md font-bold mb-2">{t('tokens')}</h2>
        <ul className="list-disc pl-4">
          {workflowData.tokens.map((tkn) => (
            <li key={tkn.token}>
              {tkn.token.toUpperCase()} — {tkn.minAllocation}%
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1">
          <p>
            <strong>{t('risk_tolerance')}:</strong> {workflowData.risk}
          </p>
          <p>
            <strong>{t('review_interval')}:</strong> {workflowData.reviewInterval}
          </p>
        </div>
      </div>
      <AgentInstructions
        value={workflowData.agentInstructions}
        onChange={(v) =>
          setWorkflowData((d) => (d ? { ...d, agentInstructions: v } : d))
        }
      />
      {user && (
        <div className="mt-4 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <ApiKeyProviderSelector
                type="ai"
                label={t('ai_provider')}
                value={aiProvider}
                onChange={setAiProvider}
              />
              {hasOpenAIKey && (models.length || draft?.model) && (
                <div className="mt-2">
                  <h2 className="text-md font-bold">{t('model')}</h2>
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
      )}

      <div className="mt-4 max-w-2xl">
        <WarningSign>
          {t('trading_agent_warning').replace(
            '{tokens}',
            workflowData.tokens
              .map((t) => t.token.toUpperCase())
              .join(` ${t('and')} `),
          )}
          <br />
          <strong>{t('dont_move_funds_warning')}</strong>
        </WarningSign>
        <label className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={workflowData.manualRebalance}
            onChange={(e) =>
              setWorkflowData((d) =>
                d ? { ...d, manualRebalance: e.target.checked } : d,
              )
            }
          />
          <span>{t('manual_rebalancing')}</span>
        </label>
        {!user && (
          <p className="text-sm text-gray-600 mb-2 mt-4">{t('log_in_to_continue')}</p>
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
                  await api.put(`/portfolio-workflows/${draft!.id}`, {
                    userId: draft!.userId,
                    model,
                    name: workflowData.name,
                    tokens: workflowData.tokens.map((t) => ({
                      token: t.token.toUpperCase(),
                      minAllocation: t.minAllocation,
                    })),
                    risk: workflowData.risk,
                    reviewInterval: workflowData.reviewInterval,
                    agentInstructions: workflowData.agentInstructions,
                    manualRebalance: workflowData.manualRebalance,
                    status: 'draft',
                  });
                } else {
                  await api.post('/portfolio-workflows', {
                    userId: user.id,
                    model,
                    name: workflowData.name,
                    tokens: workflowData.tokens.map((t) => ({
                      token: t.token.toUpperCase(),
                      minAllocation: t.minAllocation,
                    })),
                    risk: workflowData.risk,
                    reviewInterval: workflowData.reviewInterval,
                    agentInstructions: workflowData.agentInstructions,
                    manualRebalance: workflowData.manualRebalance,
                    status: 'draft',
                  });
                }
                setIsSavingDraft(false);
                toast.show(t('draft_saved_successfully'), 'success');
                navigate('/');
              } catch (err) {
                setIsSavingDraft(false);
                if (axios.isAxiosError(err) && err.response?.data?.error) {
                  toast.show(err.response.data.error);
                } else {
                  toast.show(t('failed_save_draft'));
                }
              }
            }}
          >
            {isDraft ? t('update_draft') : t('save_draft')}
          </Button>
          <AgentStartButton
            draft={draft}
            agentData={workflowData}
            model={model}
            disabled={!user || !hasOpenAIKey || !hasBinanceKey || !model}
          />
        </div>
      </div>
    </div>
  );
}
