import { db } from '../../src/db/index.js';
import { insertExecResult as insertExecResultProd } from '../../src/repos/agent-exec-result.js';

export const insertExecResult = insertExecResultProd;

export async function clearAgentExecResult() {
  await db.query('DELETE FROM agent_exec_result');
}
