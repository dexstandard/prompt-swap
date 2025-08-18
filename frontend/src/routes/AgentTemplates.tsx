import { useState, useCallback } from 'react';
import { useUser } from '../lib/useUser';
import api from '../lib/axios';
import AgentTemplateForm from '../components/forms/AgentTemplateForm';
import PriceChart from '../components/forms/PriceChart';
import AgentTemplatesTable from '../components/AgentTemplatesTable';
import ErrorBoundary from '../components/ErrorBoundary';

interface AgentTemplateDetails {
  id: string;
  name: string;
  tokenA: string;
  tokenB: string;
  targetAllocation: number;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
}

export default function AgentTemplates() {
  const { user } = useUser();
  const [tokens, setTokens] = useState({ tokenA: 'USDT', tokenB: 'SOL' });
  const [editing, setEditing] = useState<AgentTemplateDetails | null>(null);

  const handleTokensChange = useCallback((a: string, b: string) => {
    setTokens((prev) =>
      prev.tokenA === a && prev.tokenB === b ? prev : { tokenA: a, tokenB: b }
    );
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex gap-3 items-stretch">
        <ErrorBoundary>
          <PriceChart tokenA={tokens.tokenA} tokenB={tokens.tokenB} />
        </ErrorBoundary>
        <AgentTemplateForm
          onTokensChange={handleTokensChange}
          template={editing ?? undefined}
          onSubmitSuccess={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      </div>
      <ErrorBoundary>
        <AgentTemplatesTable
          onEdit={async (id) => {
            if (!user) return;
            const res = await api.get(`/agent-templates/${id}`);
            setEditing(res.data);
          }}
        />
      </ErrorBoundary>
    </div>
  );
}
