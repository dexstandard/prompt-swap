const icons: Record<string, string> = {
  BTC: '/tokens/bitcoin-btc-logo.svg',
  ETH: '/tokens/ethereum-eth-logo.svg',
  SOL: '/tokens/solana-sol-logo.svg',
  USDT: '/tokens/tether-usdt-logo.svg',
};

export type TokenProps = {
  symbol: string;
  className?: string;
  iconClassName?: string;
};

export default function Token({symbol, className = '', iconClassName = 'w-4 h-4'}: TokenProps) {
  const upper = symbol.toUpperCase();
  const src = icons[upper];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {src && <img src={src} alt={upper} className={iconClassName} />}
      <span>{upper}</span>
    </span>
  );
}
