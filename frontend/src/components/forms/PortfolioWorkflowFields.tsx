import { useEffect, useState } from 'react';
import {
  useFormContext,
  Controller,
  useFieldArray,
  useWatch,
} from 'react-hook-form';
import { Plus, Trash } from 'lucide-react';
import type { BalanceInfo } from '../../lib/usePrerequisites';
import type { BinanceAccount } from '../../lib/useBinanceAccount';
import { useTranslation } from '../../lib/i18n';
import { tokens, stableCoins, riskOptions, reviewIntervalOptions, type PortfolioReviewFormValues } from '../../lib/constants';
import TokenSelect from './TokenSelect';
import TextInput from './TextInput';
import SelectInput from './SelectInput';
import Toggle from '../ui/Toggle';

interface Props {
  onTokensChange?: (tokens: string[]) => void;
  balances: BalanceInfo[];
  accountBalances: BinanceAccount['balances'];
  autoPopulateTopTokens?: boolean;
  useEarn: boolean;
  onUseEarnChange: (v: boolean) => void;
}

export default function PortfolioWorkflowFields({
  onTokensChange,
  balances,
  accountBalances,
  autoPopulateTopTokens = false,
  useEarn,
  onUseEarnChange,
}: Props) {
  const { control, watch } = useFormContext<PortfolioReviewFormValues>();
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'tokens',
  });
  const tokensWatch = useWatch({
    control,
    name: 'tokens',
    defaultValue: [],
  }) as PortfolioReviewFormValues['tokens'];
  const t = useTranslation();
  const [initializedTopTokens, setInitializedTopTokens] = useState(
    !autoPopulateTopTokens,
  );

  const tokenSet = new Set(tokens.map((t) => t.value));
  const topTokens = accountBalances
    .map((b) => ({ token: b.asset.toUpperCase(), total: b.free + b.locked }))
    .filter(
      (b) =>
        b.total > 0 &&
        !stableCoins.includes(b.token) &&
        tokenSet.has(b.token),
    )
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((b) => b.token);

  useEffect(() => {
    if (!autoPopulateTopTokens || initializedTopTokens) return;
    if (topTokens.length > 0) {
      const stable = tokensWatch[0]?.token;
      const newTokens = [stable, ...topTokens]
        .filter((t): t is string => Boolean(t))
        .slice(0, 5);
      replace(
        newTokens.map((t) => ({
          token: t,
          minAllocation: 0,
        })),
      );
      onTokensChange?.(newTokens);
      setInitializedTopTokens(true);
    }
  }, [
    autoPopulateTopTokens,
    topTokens,
    initializedTopTokens,
    replace,
    onTokensChange,
    tokensWatch,
  ]);

  useEffect(() => {
    onTokensChange?.(
      tokensWatch
        .map((t) => t.token)
        .filter((t): t is string => Boolean(t)),
    );
  }, [tokensWatch, onTokensChange]);

  const colTemplate = 'grid-cols-[7rem_6rem_4rem_auto]';

  const totalUsd = tokensWatch.reduce((sum, t) => {
    const balanceInfo = balances.find((b) => b.token === t.token);
    if (!balanceInfo) return sum;
    const totalBalance = balanceInfo.walletBalance + balanceInfo.earnBalance;
    const price = totalBalance > 0 ? balanceInfo.usdValue / totalBalance : 0;
    const usd =
      (balanceInfo.walletBalance + (useEarn ? balanceInfo.earnBalance : 0)) *
      price;
    return sum + usd;
  }, 0);

  const handleAddToken = () => {
    const available = tokens.filter(
      (t) => !tokensWatch.some((tw) => tw.token === t.value),
    );
    const newToken = available[0]?.value || tokens[0].value;
    append({ token: newToken, minAllocation: 0 });
    onTokensChange?.([
      ...tokensWatch
        .map((t) => t.token)
        .filter((t): t is string => Boolean(t)),
      newToken,
    ]);
  };

  const handleRemoveToken = (index: number) => {
    if (index === 0 || fields.length <= 2) return;
    const newTokens = tokensWatch
      .filter((_, i) => i !== index)
      .map((t) => t.token)
      .filter((t): t is string => Boolean(t));
    remove(index);
    onTokensChange?.(newTokens);
  };

  return (
    <>
      <div className="space-y-2 w-fit">
        <div
          className={`grid ${colTemplate} gap-2 text-sm font-medium`}
        >
          <div className="text-left">Token</div>
          <div className="text-left">
            {useEarn ? 'Spot + Earn' : 'Spot'}
          </div>
          <div className="text-left">Min %</div>
          <div />
        </div>
        {fields.map((field, index) => {
          const token = watch(`tokens.${index}.token`);
          const balanceInfo = balances.find((b) => b.token === token);
          return (
            <div
              key={field.id}
              className={`grid ${colTemplate} items-center gap-2`}
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
                        !tokensWatch.some(
                          (tw, i) => tw.token === t.value && i !== index,
                        ),
                    )}
                    disabled={index === 0}
                  />
                )}
              />
              <span className="text-sm text-left">
                {balanceInfo
                  ? (
                      balanceInfo.walletBalance +
                      (useEarn ? balanceInfo.earnBalance : 0)
                    ).toFixed(5)
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
      <div className="text-sm font-medium text-left mt-2">
        Total $: {totalUsd.toFixed(2)}
      </div>
      <div className="grid grid-cols-3 gap-4 items-center mt-4">
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
          <label
            htmlFor="reviewInterval"
            className="block text-sm font-medium"
          >
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
            onChange={onUseEarnChange}
            labelPosition="top"
          />
        </div>
      </div>
    </>
  );
}
