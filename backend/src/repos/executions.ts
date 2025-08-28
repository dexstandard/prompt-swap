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
