import { useState, useCallback } from 'react';
import IndexForm from '../components/forms/IndexForm';
import TokenPriceGraph from '../components/forms/TokenPriceGraph';
import IndexTemplatesTable from '../components/IndexTemplatesTable';
import ErrorBoundary from '../components/ErrorBoundary';

export default function CreateIndex() {
  const [tokens, setTokens] = useState({ tokenA: 'USDT', tokenB: 'SOL' });

  const handleTokensChange = useCallback((a: string, b: string) => {
    setTokens((prev) =>
      prev.tokenA === a && prev.tokenB === b ? prev : { tokenA: a, tokenB: b }
    );
  }, []);

  return (
    <div className="flex items-start gap-3 w-full">
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <ErrorBoundary>
          <TokenPriceGraph tokenA={tokens.tokenA} tokenB={tokens.tokenB} />
        </ErrorBoundary>
        <ErrorBoundary>
          <IndexTemplatesTable />
        </ErrorBoundary>
      </div>
      <IndexForm onTokensChange={handleTokensChange} />
    </div>
  );
}
