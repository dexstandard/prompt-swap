import { useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import AgentStatusLabel from './AgentStatusLabel';
import TokenDisplay from './TokenDisplay';
import StrategyForm from './StrategyForm';
import AgentPnl from './AgentPnl';
import FormattedDate from './ui/FormattedDate';
import type { Agent } from '../lib/useAgentData';

interface Props {
  agent: Agent;
}

export default function AgentDetailsDesktop({ agent }: Props) {
  const [showStrategy, setShowStrategy] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const strategyData = {
    tokenA: agent.tokenA,
    tokenB: agent.tokenB,
    minTokenAAllocation: agent.minTokenAAllocation,
    minTokenBAllocation: agent.minTokenBAllocation,
    risk: agent.risk,
    reviewInterval: agent.reviewInterval,
  };

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
        <TokenDisplay token={agent.tokenA} />
        <span>/</span>
        <TokenDisplay token={agent.tokenB} />
      </p>
      <div className="mt-2">
        <div
          className="flex items-center gap-1 cursor-pointer"
          onClick={() => setShowStrategy((s) => !s)}
        >
          <h2 className="text-l font-bold">Strategy</h2>
          {showStrategy ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
        {showStrategy && (
          <div className="mt-2 max-w-2xl">
            <StrategyForm data={strategyData} onChange={() => {}} disabled />
          </div>
        )}
      </div>
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
        tokenA={agent.tokenA}
        tokenB={agent.tokenB}
        startBalanceUsd={agent.startBalanceUsd}
      />
    </div>
  );
}
