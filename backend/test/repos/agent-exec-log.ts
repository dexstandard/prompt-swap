import { db } from '../../src/db/index.js';
import { insertExecLog as insertExecLogProd } from '../../src/repos/agent-exec-log.js';

export function insertExecLog(entry: any) {
  return insertExecLogProd({
    agentId: entry.agentId,
    prompt: entry.prompt,
    response: entry.response,
  });
}

export async function getAgentExecResponses(agentId: string) {
  const { rows } = await db.query(
    'SELECT response FROM agent_exec_log WHERE agent_id = $1',
    [agentId],
  );
  return rows as { response: string | null }[];
}

export async function getAgentExecPromptsResponses(agentId: string) {
  const { rows } = await db.query(
    'SELECT prompt, response FROM agent_exec_log WHERE agent_id = $1',
    [agentId],
  );
  return rows as { prompt: string | null; response: string | null }[];
}
