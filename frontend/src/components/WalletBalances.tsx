import TokenDisplay from './TokenDisplay';
import { useUser } from '../lib/useUser';
import type { BalanceInfo } from '../lib/usePrerequisites';
import { useTranslation } from '../lib/i18n';

interface Props {
  balances: BalanceInfo[];
  hasBinanceKey: boolean;
}

export default function WalletBalances({ balances, hasBinanceKey }: Props) {
  const { user } = useUser();
  const t = useTranslation();

  if (!user || !hasBinanceKey) {
    return null;
  }

  return (
    <div>
      <h3 className="text-md font-bold mb-2">{t('binance_balances')}</h3>
      {balances.map((b) => (
        <p key={b.token} className="flex items-center gap-1">
          <TokenDisplay token={b.token} className="font-bold" />
          <span>:</span>
          <span>{b.isLoading ? t('loading') : b.balance}</span>
        </p>
      ))}
    </div>
  );
}
