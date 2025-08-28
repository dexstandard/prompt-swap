import { db } from '../../src/db/index.js';

export async function getExecutions() {
  const { rows } = await db.query(
    'SELECT user_id, planned_json, status, exec_result_id FROM executions',
  );
  return rows as {
    user_id: string;
    planned_json: string;
    status: string;
    exec_result_id: string;
  }[];
}
