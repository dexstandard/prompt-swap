import type { FastifyBaseLogger } from 'fastify';
import { getActiveAgents, type ActiveAgentRow } from '../repos/agents.js';
import { prepareAgents, executeAgent } from '../agents/portfolio-review.js';

/** Workflows currently running. Used to avoid concurrent runs. */
const runningWorkflows = new Set<string>();

export function removeWorkflowFromSchedule(id: string) {
  runningWorkflows.delete(id);
}

export async function reviewAgentPortfolio(
  log: FastifyBaseLogger,
  agentId: string,
): Promise<void> {
  const agents = await getActiveAgents({ agentId });
  const { toRun, skipped } = filterRunningWorkflows(agents);
  if (skipped.length) throw new Error('Agent is already reviewing portfolio');
  await runAgents(log, toRun);
}

export default async function reviewPortfolios(
  log: FastifyBaseLogger,
  interval: string,
): Promise<void> {
  const agents = await getActiveAgents({ interval });
  const { toRun } = filterRunningWorkflows(agents);
  if (!toRun.length) return;
  await runAgents(log, toRun);
}

async function runAgents(
  log: FastifyBaseLogger,
  agents: ActiveAgentRow[],
) {
  const prepared = await prepareAgents(agents, log);
  const preparedIds = new Set(prepared.map((p) => p.row.id));
  for (const row of agents) {
    if (!preparedIds.has(row.id)) runningWorkflows.delete(row.id);
  }

  await Promise.all(
    prepared.map(({ row, prompt, key, log: lg }) =>
      executeAgent(row, prompt, key, lg).finally(() => {
        runningWorkflows.delete(row.id);
      }),
    ),
  );
}

function filterRunningWorkflows(agents: ActiveAgentRow[]) {
  const toRun: ActiveAgentRow[] = [];
  const skipped: ActiveAgentRow[] = [];
  for (const row of agents) {
    if (runningWorkflows.has(row.id)) skipped.push(row);
    else {
      runningWorkflows.add(row.id);
      toRun.push(row);
    }
  }
  return { toRun, skipped };
}
