import { db } from '../db/index.js';

export interface ExecutionEntry {
  userId: string;
  planned: Record<string, unknown>;
  status: string;
  execResultId: string;
}

export async function insertExecution(entry: ExecutionEntry): Promise<void> {
  await db.query(
    'INSERT INTO executions (user_id, planned_json, status, exec_result_id) VALUES ($1, $2, $3, $4)',
    [
      entry.userId,
      JSON.stringify(entry.planned),
      entry.status,
      entry.execResultId,
    ],
  );
}

export async function cancelPendingExecutionsByAgent(
  agentId: string,
): Promise<void> {
  await db.query(
    `UPDATE executions e
        SET status = 'canceled'
      WHERE status = 'pending'
        AND exec_result_id IN (
          SELECT id FROM agent_exec_result WHERE agent_id = $1
        )`,
    [agentId],
  );
}
