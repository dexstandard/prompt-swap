import { db } from '../../src/db/index.js';

export function clearExecutions() {
  db.prepare('DELETE FROM executions').run();
}

export function getExecutions() {
  return db
    .prepare('SELECT user_id, planned_json, status, exec_result_id FROM executions')
    .all() as { user_id: string; planned_json: string; status: string; exec_result_id: string }[];
}
