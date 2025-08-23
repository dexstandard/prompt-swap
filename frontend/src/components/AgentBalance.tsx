import { useAgentBalanceUsd } from '../lib/useAgentBalanceUsd';

interface Props {
  tokenA: string;
  tokenB: string;
}

export default function AgentBalance({ tokenA, tokenB }: Props) {
  const { balance, isLoading } = useAgentBalanceUsd(tokenA, tokenB);
  if (balance === null) return <span>-</span>;
  return <span>{isLoading ? 'Loading...' : `$${balance.toFixed(2)}`}</span>;
}
