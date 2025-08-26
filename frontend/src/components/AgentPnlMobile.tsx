import { useAgentBalanceUsd } from '../lib/useAgentBalanceUsd';

interface Props {
  tokenA: string;
  tokenB: string;
  startBalanceUsd: number | null;
}

export default function AgentPnlMobile({ tokenA, tokenB, startBalanceUsd }: Props) {
  const { balance, isLoading } = useAgentBalanceUsd(tokenA, tokenB);
  const balanceText =
    balance === null ? '-' : isLoading ? 'Loading...' : `$${balance.toFixed(2)}`;
  const pnl =
    balance !== null && startBalanceUsd != null ? balance - startBalanceUsd : null;
  const pnlText =
    pnl === null
      ? '-'
      : isLoading
      ? 'Loading...'
      : `${pnl > 0 ? '+' : pnl < 0 ? '-' : ''}$${Math.abs(pnl).toFixed(2)}`;
  const pnlClass =
    pnl === null || isLoading
      ? ''
      : pnl <= -0.03
      ? 'text-red-600'
      : pnl >= 0.03
      ? 'text-green-600'
      : 'text-gray-600';
  const pnlTooltip =
    pnl === null || isLoading
      ? undefined
      : `PnL = $${balance!.toFixed(2)} - $${startBalanceUsd!.toFixed(2)} = ${
          pnl > 0 ? '+' : pnl < 0 ? '-' : ''
        }$${Math.abs(pnl).toFixed(2)}`;
  return (
    <p className="mt-2">
      <strong>Balance:</strong> {balanceText}
      <span className="ml-4">
        <strong>PnL:</strong>{' '}
        <span className={pnlClass} title={pnlTooltip}>
          {pnlText}
        </span>
      </span>
    </p>
  );
}
