import { db } from '../db/index.js';

export interface ExecLogInsert {
  agentId: string;
  prompt?: unknown;
  response: unknown;
}

export async function insertExecLog(entry: ExecLogInsert): Promise<string> {
  const { rows } = await db.query(
    'INSERT INTO agent_exec_log (agent_id, prompt, response) VALUES ($1, $2, $3) RETURNING id',
    [
      entry.agentId,
      entry.prompt === undefined ? null : JSON.stringify(entry.prompt),
      JSON.stringify(entry.response),
    ],
  );
  return rows[0].id as string;
}
