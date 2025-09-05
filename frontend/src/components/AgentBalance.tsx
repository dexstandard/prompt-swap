import { useAgentBalanceUsd } from '../lib/useAgentBalanceUsd';

interface Props {
  tokens: string[];
}

export default function AgentBalance({ tokens }: Props) {
  const { balance, isLoading } = useAgentBalanceUsd(tokens);
  if (balance === null) return <span>-</span>;
  return <span>{isLoading ? 'Loading...' : `$${balance.toFixed(2)}`}</span>;
}
