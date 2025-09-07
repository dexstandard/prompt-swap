import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import AgentStatusLabel from './AgentStatusLabel';
import TokenDisplay from './TokenDisplay';
import AgentPnl from './AgentPnl';
import FormattedDate from './ui/FormattedDate';
import type { Agent } from '../lib/useAgentData';

interface Props {
  agent: Agent;
}

export default function AgentDetailsDesktop({ agent }: Props) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <span>Agent:</span> <span>{agent.name}</span>
      </h1>
      <p className="mt-2">
        <strong>Created:</strong> <FormattedDate date={agent.createdAt} />
      </p>
      <p className="mt-2">
        <strong>Status:</strong> <AgentStatusLabel status={agent.status} />
      </p>
      <p className="flex items-center gap-1 mt-2">
        <strong>Tokens:</strong>
        {agent.tokens.map((t, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>/</span>}
            <TokenDisplay token={t.token} />
          </span>
        ))}
      </p>
      <div className="mt-2">
        <div className="flex items-center gap-1">
          <h2 className="text-l font-bold">Trading Instructions</h2>
          {showPrompt ? (
            <EyeOff
              className="w-4 h-4 cursor-pointer"
              onClick={() => setShowPrompt(false)}
            />
          ) : (
            <Eye
              className="w-4 h-4 cursor-pointer"
              onClick={() => setShowPrompt(true)}
            />
          )}
        </div>
        {showPrompt && (
          <pre className="whitespace-pre-wrap mt-2">
            {agent.agentInstructions}
          </pre>
        )}
      </div>
      <AgentPnl
        tokens={agent.tokens.map((t) => t.token)}
        startBalanceUsd={agent.startBalanceUsd}
      />
    </div>
  );
}
