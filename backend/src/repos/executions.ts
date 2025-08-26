import { db } from '../db/index.js';

export interface ExecutionEntry {
  userId: string;
  planned: Record<string, unknown>;
  status: string;
  execResultId: string;
}

export function insertExecution(entry: ExecutionEntry): void {
  db
    .prepare(
      'INSERT INTO executions (user_id, planned_json, status, exec_result_id) VALUES (?, ?, ?, ?)',
    )
    .run(
      entry.userId,
      JSON.stringify(entry.planned),
      entry.status,
      entry.execResultId,
    );
}
