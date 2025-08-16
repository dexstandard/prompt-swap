import { useState, useCallback } from 'react';
import { useUser } from '../lib/useUser';
import api from '../lib/axios';
import IndexForm from '../components/forms/IndexForm';
import TokenPriceGraph from '../components/forms/TokenPriceGraph';
import IndexTemplatesTable from '../components/IndexTemplatesTable';
import ErrorBoundary from '../components/ErrorBoundary';

interface IndexTemplateDetails {
  id: string;
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  rebalance: string;
  agentInstructions: string;
}

export default function CreateIndex() {
  const { user } = useUser();
  const [tokens, setTokens] = useState({ tokenA: 'USDT', tokenB: 'SOL' });
  const [editing, setEditing] = useState<IndexTemplateDetails | null>(null);

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
          <IndexTemplatesTable
            onEdit={async (id) => {
              if (!user) return;
              const res = await api.get(`/index-templates/${id}`, {
                headers: { 'x-user-id': user.id },
              });
              setEditing(res.data);
            }}
          />
        </ErrorBoundary>
      </div>
      <IndexForm
        onTokensChange={handleTokensChange}
        template={editing ?? undefined}
        onSubmitSuccess={() => setEditing(null)}
      />
    </div>
  );
}
