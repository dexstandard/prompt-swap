import { db } from '../db/index.js';

export interface ExecLogEntry {
  id: string;
  agentId: string;
  prompt?: unknown;
  response: unknown;
  createdAt: number;
}

export function insertExecLog(entry: ExecLogEntry): void {
  db
    .prepare(
      'INSERT INTO agent_exec_log (id, agent_id, prompt_json, response_json, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      entry.id,
      entry.agentId,
      entry.prompt === undefined ? null : JSON.stringify(entry.prompt),
      JSON.stringify(entry.response),
      entry.createdAt,
    );
}

export function getRecentExecLogs(agentId: string, limit: number) {
  const rows = db
    .prepare<unknown[], { response_json: string | null }>(
      'SELECT response_json FROM agent_exec_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    .all(agentId, limit) as { response_json: string | null }[];
  return rows.map((r) => ({ response: r.response_json }));
}
