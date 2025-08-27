import { db } from '../db/index.js';

export interface ExecLogEntry {
  id: string;
  agentId: string;
  prompt?: unknown;
  response: unknown;
  createdAt: number;
}

export async function insertExecLog(entry: ExecLogEntry): Promise<void> {
  await db.query(
    'INSERT INTO agent_exec_log (id, agent_id, prompt, response, created_at) VALUES ($1, $2, $3, $4, $5)',
    [
      entry.id,
      entry.agentId,
      entry.prompt === undefined ? null : JSON.stringify(entry.prompt),
      JSON.stringify(entry.response),
      entry.createdAt,
    ],
  );
}
