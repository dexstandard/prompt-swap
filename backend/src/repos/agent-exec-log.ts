import { db } from '../db/index.js';

export interface ExecLogEntry {
  id: string;
  agentId: string;
  log: string;
  createdAt: number;
}

export function insertExecLog(entry: ExecLogEntry): void {
  db
    .prepare(
      'INSERT INTO agent_exec_log (id, agent_id, log, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(entry.id, entry.agentId, entry.log, entry.createdAt);
}

export function getRecentExecLogs(agentId: string, limit: number) {
  return db
    .prepare<unknown[], { log: string }>(
      'SELECT log FROM agent_exec_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    .all(agentId, limit) as { log: string }[];
}
