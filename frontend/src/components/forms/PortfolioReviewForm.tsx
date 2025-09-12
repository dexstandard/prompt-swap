import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BalanceInfo } from '../../lib/usePrerequisites';
import type { BinanceAccount } from '../../lib/useBinanceAccount';
import { useUser } from '../../lib/useUser';
import { useTranslation } from '../../lib/i18n';
import {
  DEFAULT_AGENT_INSTRUCTIONS,
  portfolioReviewDefaults,
  portfolioReviewSchema,
  type PortfolioReviewFormValues,
} from '../../lib/constants';
import Button from '../ui/Button';
import PortfolioWorkflowFields from './PortfolioWorkflowFields';

interface Props {
  onTokensChange?: (tokens: string[]) => void;
  balances: BalanceInfo[];
  accountBalances: BinanceAccount['balances'];
}

export default function PortfolioReviewForm({
  onTokensChange,
  balances,
  accountBalances,
}: Props) {
  const { user } = useUser();
  const t = useTranslation();
  const methods = useForm<PortfolioReviewFormValues>({
    resolver: zodResolver(portfolioReviewSchema),
    defaultValues: portfolioReviewDefaults,
  });
  const { handleSubmit, formState: { isSubmitting } } = methods;
  const [useEarn, setUseEarn] = useState(true);

  const navigate = useNavigate();

  const onSubmit = async (values: PortfolioReviewFormValues) => {
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
      useEarn,
    };
    navigate('/portfolio-workflow-draft', { state: previewData });
  };

  return (
    <FormProvider {...methods}>
      <div className="bg-white shadow-md border border-gray-200 rounded p-6 w-fit max-w-lg self-start">
        <h2 className="text-xl font-bold mb-4">{t('agent')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full">
          <PortfolioWorkflowFields
            onTokensChange={onTokensChange}
            balances={balances}
            accountBalances={accountBalances}
            autoPopulateTopTokens
            useEarn={useEarn}
            onUseEarnChange={setUseEarn}
          />
          {!user && (
            <p className="text-sm text-gray-600 mb-2">{t('log_in_to_continue')}</p>
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
      </div>
    </FormProvider>
  );
}
