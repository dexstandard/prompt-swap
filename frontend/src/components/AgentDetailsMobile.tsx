import AgentStatusLabel from './AgentStatusLabel';
import TokenDisplay from './TokenDisplay';
import AgentPnlMobile from './AgentPnlMobile';
import FormattedDate from './ui/FormattedDate';
import DerivativesSummary from './DerivativesSummary';
import type { Agent } from '../lib/useAgentData';

interface Props {
  agent: Agent;
}

export default function AgentDetailsMobile({ agent }: Props) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold truncate flex-1">Agent: {agent.name}</h1>
        <AgentStatusLabel status={agent.status} />
      </div>
      <p className="text-sm text-gray-500">
        <FormattedDate date={agent.createdAt} />
      </p>
      <p className="flex items-center gap-1 mt-2">
        {agent.tokens.map((t, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>/</span>}
            <TokenDisplay token={t.token} />
          </span>
        ))}
      </p>
      <DerivativesSummary symbol={agent.tokens.map((t) => t.token).join('').toUpperCase()} />
      <AgentPnlMobile
        tokens={agent.tokens.map((t) => t.token)}
        startBalanceUsd={agent.startBalanceUsd}
      />
    </div>
  );
}
