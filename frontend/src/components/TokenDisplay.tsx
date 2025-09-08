
const ICONS: Record<string, string> = {
  BTC: '/tokens/bitcoin-btc-logo.svg',
  ETH: '/tokens/ethereum-eth-logo.svg',
  SOL: '/tokens/solana-sol-logo.svg',
  USDT: '/tokens/tether-usdt-logo.svg',
  USDC: '/tokens/usd-coin-usdc-logo.svg',
};

export default function TokenDisplay({ token, className = '' }: { token: string; className?: string }) {
  const symbol = token.toUpperCase();
  const src = ICONS[symbol];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {src && <img src={src} alt={`${symbol} logo`} className="w-4 h-4" />}
      <span className="uppercase">{symbol}</span>
    </span>
  );
}
