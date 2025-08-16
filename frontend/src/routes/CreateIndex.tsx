import { useState } from 'react';
import IndexForm from '../components/forms/IndexForm';
import TokenPriceGraph from '../components/forms/TokenPriceGraph';
import ErrorBoundary from '../components/ErrorBoundary';

export default function CreateIndex() {
  const [tokens, setTokens] = useState({ tokenA: 'USDT', tokenB: 'SOL' });

  return (
    <div className="flex items-start justify-center p-4 gap-4">
      <ErrorBoundary>
        <TokenPriceGraph tokenA={tokens.tokenA} tokenB={tokens.tokenB} />
      </ErrorBoundary>
      <IndexForm onTokensChange={(a, b) => setTokens({ tokenA: a, tokenB: b })} />
    </div>
  );
}
