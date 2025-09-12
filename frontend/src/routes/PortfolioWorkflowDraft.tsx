import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../lib/i18n';
import AgentName from '../components/AgentName';
import AgentInstructions from '../components/AgentInstructions';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import api from '../lib/axios';
import { useUser } from '../lib/useUser';
import ApiKeyProviderSelector from '../components/forms/ApiKeyProviderSelector';
import { useToast } from '../lib/useToast';
import Button from '../components/ui/Button';
import { usePrerequisites } from '../lib/usePrerequisites';
import AgentStartButton from '../components/AgentStartButton';
import SelectInput from '../components/forms/SelectInput';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { portfolioReviewSchema, type PortfolioReviewFormValues } from '../lib/constants';
import PortfolioWorkflowFields from '../components/forms/PortfolioWorkflowFields';

interface WorkflowDraftDetails {
  name: string;
  tokens: { token: string; minAllocation: number }[];
  risk: PortfolioReviewFormValues['risk'];
  reviewInterval: PortfolioReviewFormValues['reviewInterval'];
  agentInstructions: string;
  manualRebalance: boolean;
  useEarn: boolean;
}

interface SavedDraft extends WorkflowDraftDetails {
  id: string;
  userId: string;
  model: string | null;
}

interface Props {
  draft?: SavedDraft;
}

export default function PortfolioWorkflowDraft({ draft }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationData = location.state as WorkflowDraftDetails | undefined;
  const { user } = useUser();
  const toast = useToast();
  const t = useTranslation();
  const data = draft ?? locationData;
  const [model, setModel] = useState(draft?.model || '');
  const [aiProvider, setAiProvider] = useState('openai');
  const [useEarn, setUseEarn] = useState(data?.useEarn ?? true);
  const [tokenSymbols, setTokenSymbols] = useState(
    data ? data.tokens.map((t) => t.token) : [],
  );

  const methods = useForm<PortfolioReviewFormValues>({
    resolver: zodResolver(portfolioReviewSchema),
    defaultValues: data
      ? {
          tokens: data.tokens,
          risk: data.risk,
          reviewInterval: data.reviewInterval,
        }
      : undefined,
  });
  const { hasOpenAIKey, hasBinanceKey, models, balances, accountBalances } =
    usePrerequisites(tokenSymbols);

  const [name, setName] = useState(data?.name || '');
  const [agentInstructions, setAgentInstructions] = useState(
    data?.agentInstructions || '',
  );
  const [manualRebalance, setManualRebalance] = useState(
    data?.manualRebalance || false,
  );
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const values = methods.watch();

  if (!data) return <div className="p-4">{t('no_preview_data')}</div>;

  function WarningSign({ children }: { children: ReactNode }) {
    return (
      <div className="mt-2 p-4 text-sm text-red-600 border border-red-600 rounded bg-red-100">
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <span>{t('agent_draft')}:</span>
        <AgentName
          name={name}
          onChange={setName}
          className="text-2xl font-bold"
        />
      </h1>
      <FormProvider {...methods}>
        <div className="max-w-xl">
          <PortfolioWorkflowFields
            onTokensChange={setTokenSymbols}
            balances={balances}
            accountBalances={accountBalances}
            useEarn={useEarn}
            onUseEarnChange={setUseEarn}
          />
        </div>
      </FormProvider>
      <AgentInstructions value={agentInstructions} onChange={setAgentInstructions} />
      {user && (
        <div className="mt-4 max-w-xl">
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <ApiKeyProviderSelector
              type="ai"
              label={t('ai_provider')}
              value={aiProvider}
              onChange={setAiProvider}
            />
            {hasOpenAIKey && (models.length || draft?.model) && (
              <div>
                <label
                  htmlFor="model"
                  className="block text-sm font-medium"
                >
                  {t('model')}
                </label>
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
        </div>
      )}

      <div className="mt-4 max-w-xl">
        <WarningSign>
          {t('trading_agent_warning').replace(
            '{tokens}',
            tokenSymbols.map((t) => t.toUpperCase()).join(` ${t('and')} `),
          )}
          <br />
          <strong>{t('dont_move_funds_warning')}</strong>
        </WarningSign>
        <label className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={manualRebalance}
            onChange={(e) => setManualRebalance(e.target.checked)}
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
                const values = methods.getValues();
                if (draft) {
                  await api.put(`/portfolio-workflows/${draft.id}`, {
                    userId: draft.userId,
                    model,
                    name,
                    tokens: values.tokens.map((t) => ({
                      token: t.token.toUpperCase(),
                      minAllocation: t.minAllocation,
                    })),
                    risk: values.risk,
                    reviewInterval: values.reviewInterval,
                    agentInstructions,
                    manualRebalance,
                    useEarn,
                    status: 'draft',
                  });
                } else {
                  await api.post('/portfolio-workflows', {
                    userId: user.id,
                    model,
                    name,
                    tokens: values.tokens.map((t) => ({
                      token: t.token.toUpperCase(),
                      minAllocation: t.minAllocation,
                    })),
                    risk: values.risk,
                    reviewInterval: values.reviewInterval,
                    agentInstructions,
                    manualRebalance,
                    useEarn,
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
            {draft ? t('update_draft') : t('save_draft')}
          </Button>
          <AgentStartButton
            draft={draft}
            agentData={{
              name,
              tokens: values.tokens.map((t) => ({ token: t.token, minAllocation: t.minAllocation })),
              risk: values.risk,
              reviewInterval: values.reviewInterval,
              agentInstructions,
              manualRebalance,
              useEarn,
            }}
            model={model}
            disabled={!user || !hasOpenAIKey || !hasBinanceKey || !model}
          />
        </div>
      </div>
    </div>
  );
}
