import { useState, useCallback } from 'react';
import IndexForm from '../components/forms/IndexForm';
import TokenPriceGraph from '../components/forms/TokenPriceGraph';
import ErrorBoundary from '../components/ErrorBoundary';

export default function CreateIndex() {
  const [tokens, setTokens] = useState({ tokenA: 'USDT', tokenB: 'SOL' });

  const handleTokensChange = useCallback((a: string, b: string) => {
    setTokens((prev) =>
      prev.tokenA === a && prev.tokenB === b ? prev : { tokenA: a, tokenB: b }
    );
  }, []);

  return (
    <div className="flex items-start p-3 gap-3 w-full">
      <ErrorBoundary>
        <TokenPriceGraph tokenA={tokens.tokenA} tokenB={tokens.tokenB} />
      </ErrorBoundary>
      <IndexForm onTokensChange={handleTokensChange} />
    </div>
  );
}
