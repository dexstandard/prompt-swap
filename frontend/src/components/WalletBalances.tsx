import TokenDisplay from './TokenDisplay';
import { useUser } from '../lib/useUser';
import type { BalanceInfo } from '../lib/usePrerequisites';

interface Props {
  balances: BalanceInfo[];
  hasBinanceKey: boolean;
}

export default function WalletBalances({ balances, hasBinanceKey }: Props) {
  const { user } = useUser();

  if (!user || !hasBinanceKey) {
    return (
      <div>
        <h3 className="text-xl font-bold mb-2">Binance Balances</h3>
        <p>Binance Balances - Unavailable</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold mb-2">Binance Balances</h3>
      {balances.map((b) => (
        <p key={b.token} className="flex items-center gap-1">
          <TokenDisplay token={b.token} className="font-bold" />
          <span>:</span>
          <span>{b.isLoading ? 'Loading...' : b.balance}</span>
        </p>
      ))}
    </div>
  );
}
