import { db } from '../../src/db/index.js';
import { insertExecLog as insertExecLogProd } from '../../src/repos/agent-exec-log.js';

export const insertExecLog = insertExecLogProd;

export function clearAgentExecLog() {
  db.prepare('DELETE FROM agent_exec_log').run();
}

export function getAgentExecResponses(agentId: string) {
  return db
    .prepare('SELECT response FROM agent_exec_log WHERE agent_id = ?')
    .all(agentId) as { response: string | null }[];
}

export function getAgentExecPromptsResponses(agentId: string) {
  return db
    .prepare('SELECT prompt, response FROM agent_exec_log WHERE agent_id = ?')
    .all(agentId) as { prompt: string | null; response: string | null }[];
}
