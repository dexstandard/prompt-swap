import { useAgentBalanceUsd } from '../lib/useAgentBalanceUsd';
import { useTranslation } from '../lib/i18n';

interface Props {
  tokens: string[];
}

export default function AgentBalance({ tokens }: Props) {
  const t = useTranslation();
  const { balance, isLoading } = useAgentBalanceUsd(tokens);
  if (balance === null) return <span>-</span>;
  return <span>{isLoading ? t('loading') : `$${balance.toFixed(2)}`}</span>;
}
