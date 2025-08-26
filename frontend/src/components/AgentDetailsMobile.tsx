import AgentStatusLabel from './AgentStatusLabel';
import TokenDisplay from './TokenDisplay';
import AgentPnlMobile from './AgentPnlMobile';
import FormattedDate from './ui/FormattedDate';
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
        <TokenDisplay token={agent.tokenA} />
        <span>/</span>
        <TokenDisplay token={agent.tokenB} />
      </p>
      <AgentPnlMobile
        tokenA={agent.tokenA}
        tokenB={agent.tokenB}
        startBalanceUsd={agent.startBalanceUsd}
      />
    </div>
  );
}
