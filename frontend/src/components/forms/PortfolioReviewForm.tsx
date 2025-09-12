import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash } from 'lucide-react';
import type { BalanceInfo } from '../../lib/usePrerequisites';
import { useTranslation } from '../../lib/i18n';
import {
  DEFAULT_AGENT_INSTRUCTIONS,
  portfolioReviewDefaults,
  portfolioReviewSchema,
  type PortfolioReviewFormValues,
  riskOptions,
  reviewIntervalOptions,
  tokens,
  stableCoins,
} from '../../lib/constants';
import { useBinanceAccount } from '../../lib/useBinanceAccount';
import TokenSelect from './TokenSelect';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';

interface Props {
  onTokensChange?: (tokens: string[]) => void;
  balances: BalanceInfo[];
}

export default function PortfolioReviewForm({
  onTokensChange,
  balances,
}: Props) {
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

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'tokens',
  });
  const tokensWatch = watch('tokens');

  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountQuery = useBinanceAccount();
  const tokenSet = new Set(tokens.map((t) => t.value));
  const topTokens = (accountQuery.data?.balances ?? [])
    .map((b) => ({
      token: b.asset.toUpperCase(),
      total: b.free + b.locked,
    }))
    .filter(
      (b) =>
        b.total > 0 &&
        !stableCoins.includes(b.token) &&
        tokenSet.has(b.token),
    )
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((b) => b.token);

  const [initializedTopTokens, setInitializedTopTokens] = useState(false);
  const [useEarn, setUseEarn] = useState(true);
  const colTemplate = useEarn
    ? 'grid-cols-[1.5fr_2fr_2fr_2fr_1fr_auto]'
    : 'grid-cols-[1.5fr_2fr_2fr_1fr_auto]';

  useEffect(() => {
    if (initializedTopTokens) return;
    if (topTokens.length > 0) {
      const stable = tokensWatch[0]?.token;
      const newTokens = [stable, ...topTokens].slice(0, 5);
      replace(newTokens.map((t) => ({ token: t, minAllocation: 0 })));
      onTokensChange?.(newTokens);
      setInitializedTopTokens(true);
    }
  }, [topTokens, initializedTopTokens, replace, onTokensChange, tokensWatch]);

  const onSubmit = (values: PortfolioReviewFormValues) => {
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
  };

  const handleAddToken = () => {
    const available = tokens.filter(
      (t) => !tokensWatch.some((tw) => tw.token === t.value),
    );
    const newToken = available[0]?.value || tokens[0].value;
    append({ token: newToken, minAllocation: 0 });
    onTokensChange?.([...tokensWatch.map((t) => t.token), newToken]);
  };

  const handleRemoveToken = (index: number) => {
    if (index === 0 || fields.length <= 2) return;
    const newTokens = tokensWatch
      .filter((_, i) => i !== index)
      .map((t) => t.token);
    remove(index);
    onTokensChange?.(newTokens);
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
        onSubmit={handleSubmit(onSubmit)}
        className={`bg-white shadow-md border border-gray-200 rounded p-6 space-y-4 w-full max-w-[40rem] ${
          mobileOpen ? '' : 'hidden'
        } md:block`}
      >
        <h2 className="text-lg md:text-xl font-bold">Binance Portfolio Workflow</h2>
        <div className="space-y-2">
          <div className={`grid ${colTemplate} gap-2 text-sm font-medium`}>
            <div className="text-left">Token</div>
            <div className="text-left">Spot</div>
            {useEarn && <div className="text-left">Earn</div>}
            <div className="text-left">Total (USD)</div>
            <div className="text-left">Min %</div>
            <div />
          </div>
          {fields.map((field, index) => {
            const token = tokensWatch[index]?.token;
            const balanceInfo = balances.find(
              (b) => b.token.toUpperCase() === token?.toUpperCase(),
            );
            return (
              <div
                key={field.id}
                className={`grid ${colTemplate} gap-2 items-center`}
              >
                <Controller
                  name={`tokens.${index}.token`}
                  control={control}
                  render={({ field }) => (
                    <TokenSelect
                      id={`token-${index}`}
                      value={field.value}
                      onChange={(val) => {
                        field.onChange(val);
                        const newTokens = tokensWatch.map((t, i) =>
                          i === index ? { ...t, token: val } : t,
                        );
                        onTokensChange?.(newTokens.map((t) => t.token));
                      }}
                    options={
                      index === 0
                        ? tokens.filter((t) => stableCoins.includes(t.value))
                        : tokens.filter(
                            (t) =>
                              t.value === field.value ||
                              !tokensWatch.some(
                                (tw, i) => tw.token === t.value && i !== index,
                              ),
                          )
                    }
                  />
                  )}
                />
                <span className="text-sm text-left">
                  {balanceInfo?.isLoading
                    ? t('loading')
                    : balanceInfo
                    ? balanceInfo.walletBalance.toFixed(5)
                    : '0.00000'}
                </span>
                {useEarn && (
                  <span className="text-sm text-left">
                    {balanceInfo?.isLoading
                      ? t('loading')
                      : balanceInfo
                      ? balanceInfo.earnBalance.toFixed(5)
                      : '0.00000'}
                  </span>
                )}
                <span className="text-sm text-left">
                  {balanceInfo?.isLoading
                    ? t('loading')
                    : balanceInfo
                    ? (() => {
                        const totalBalance =
                          balanceInfo.walletBalance + balanceInfo.earnBalance;
                        const price =
                          totalBalance > 0
                            ? balanceInfo.usdValue / totalBalance
                            : 0;
                        const usd =
                          (balanceInfo.walletBalance +
                            (useEarn ? balanceInfo.earnBalance : 0)) * price;
                        return usd.toFixed(5);
                      })()
                    : '0.00000'}
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
                <button
                  type="button"
                  onClick={() => handleRemoveToken(index)}
                  disabled={index === 0 || fields.length <= 2}
                  className="text-red-600 disabled:opacity-50"
                >
                  <Trash className="w-4 h-4" />
                </button>
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
        <div className="grid grid-cols-3 gap-4 items-center">
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
          <div className="flex justify-center h-full">
            <Toggle
              label={t('use_binance_earn')}
              checked={useEarn}
              onChange={setUseEarn}
              labelPosition="top"
            />
          </div>
        </div>
        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting}
        >
          {t('preview')}
        </Button>
      </form>
    </>
  );
}

