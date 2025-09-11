import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import type { BalanceInfo } from '../../lib/usePrerequisites';
import { useUser } from '../../lib/useUser';
import { useTranslation } from '../../lib/i18n';
import {
  DEFAULT_AGENT_INSTRUCTIONS,
  portfolioReviewDefaults,
  portfolioReviewSchema,
  type PortfolioReviewFormValues,
  riskOptions,
  reviewIntervalOptions,
  tokens,
} from '../../lib/constants';
import TokenSelect from './TokenSelect';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import Button from '../ui/Button';

interface Props {
  onTokensChange?: (tokens: string[]) => void;
  balances: BalanceInfo[];
}

export default function PortfolioReviewForm({
  onTokensChange,
  balances,
}: Props) {
  const { user } = useUser();
  const t = useTranslation();
  const {
    handleSubmit,
    watch,
    control,
    formState: { isSubmitting },
  } = useForm<PortfolioReviewFormValues>({
    resolver: zodResolver(portfolioReviewSchema),
    defaultValues: portfolioReviewDefaults,
  });

  const { fields, append } = useFieldArray({ control, name: 'tokens' });
  const tokensWatch = watch('tokens');

  useEffect(() => {
    onTokensChange?.(tokensWatch.map((t) => t.token));
  }, [tokensWatch, onTokensChange]);

  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    const previewData = {
      name: values.tokens.map((t) => t.token.toUpperCase()).join(' / '),
      tokens: values.tokens.map((t) => ({
        token: t.token.toUpperCase(),
        minAllocation: t.minAllocation,
      })),
      risk: values.risk,
      reviewInterval: values.reviewInterval,
      agentInstructions: DEFAULT_AGENT_INSTRUCTIONS,
      manualRebalance: false,
    };
    navigate('/portfolio-workflow-preview', { state: previewData });
  });

  const handleAddToken = () => {
    const available = tokens.filter(
      (t) => !tokensWatch.some((tw) => tw.token === t.value),
    );
    append({ token: available[0]?.value || tokens[0].value, minAllocation: 0 });
  };

  return (
    <>
      {!mobileOpen && (
        <Button
          type="button"
          className="w-full md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          Binance Portfolio Workflow
        </Button>
      )}
      <form
        onSubmit={onSubmit}
        className={`bg-white shadow-md border border-gray-200 rounded p-6 space-y-4 w-full max-w-[30rem] ${
          mobileOpen ? '' : 'hidden'
        } md:block`}
      >
        <h2 className="text-lg md:text-xl font-bold">Binance Portfolio Workflow</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-sm font-medium">
            <span>Token</span>
            <span>Spot</span>
            <span>Earn</span>
            <span>Min allocation</span>
          </div>
          {fields.map((field, index) => {
            const token = tokensWatch[index]?.token;
            const balanceInfo = balances.find(
              (b) => b.token.toUpperCase() === token?.toUpperCase(),
            );
            return (
              <div
                key={field.id}
                className="grid grid-cols-4 gap-2 items-center"
              >
                <Controller
                  name={`tokens.${index}.token`}
                  control={control}
                  render={({ field }) => (
                    <TokenSelect
                      id={`token-${index}`}
                      value={field.value}
                      onChange={field.onChange}
                      options={tokens.filter(
                        (t) =>
                          t.value === field.value ||
                          !tokensWatch.some((tw, i) => tw.token === t.value && i !== index),
                      )}
                    />
                  )}
                />
                <span className="text-sm">
                  {balanceInfo?.isLoading
                    ? t('loading')
                    : balanceInfo?.walletBalance ?? 0}
                </span>
                <span className="text-sm">
                  {balanceInfo?.isLoading
                    ? t('loading')
                    : balanceInfo?.earnBalance ?? 0}
                </span>
                <Controller
                  name={`tokens.${index}.minAllocation`}
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id={`minAllocation-${index}`}
                      type="number"
                      min={0}
                      max={95}
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ''
                            ? ''
                            : Number(e.target.value),
                        )
                      }
                    />
                  )}
                />
              </div>
            );
          })}
          {fields.length < 5 && (
            <button
              type="button"
              onClick={handleAddToken}
              className="flex items-center gap-1 text-blue-600"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="risk" className="block text-sm font-medium">
              {t('risk_tolerance')}
            </label>
            <Controller
              name="risk"
              control={control}
              render={({ field }) => (
                <SelectInput
                  id="risk"
                  value={field.value}
                  onChange={field.onChange}
                  options={riskOptions}
                />
              )}
            />
          </div>
          <div>
            <label htmlFor="reviewInterval" className="block text-sm font-medium">
              {t('review_interval')}
            </label>
            <Controller
              name="reviewInterval"
              control={control}
              render={({ field }) => (
                <SelectInput
                  id="reviewInterval"
                  value={field.value}
                  onChange={field.onChange}
                  options={reviewIntervalOptions(t)}
                />
              )}
            />
          </div>
        </div>
        {!user && (
          <p className="text-sm text-gray-600 mb-2">
            {t('log_in_to_continue')}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={!user}
          loading={isSubmitting}
        >
          {t('preview')}
        </Button>
      </form>
    </>
  );
}

