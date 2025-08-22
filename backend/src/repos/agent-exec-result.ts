import { db } from '../db/index.js';

export interface ExecResultEntry {
  id: string;
  agentId: string;
  log: string;
  rebalance?: boolean;
  newAllocation?: number;
  shortReport?: string;
  error?: Record<string, unknown>;
  createdAt: number;
}

export function insertExecResult(entry: ExecResultEntry): void {
  db.prepare(
    'INSERT INTO agent_exec_result (id, agent_id, log, rebalance, new_allocation, short_report, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    entry.id,
    entry.agentId,
    entry.log,
    entry.rebalance === undefined ? null : entry.rebalance ? 1 : 0,
    entry.newAllocation ?? null,
    entry.shortReport ?? null,
    entry.error ? JSON.stringify(entry.error) : null,
    entry.createdAt,
  );
}

export function getAgentExecResults(agentId: string, limit: number, offset: number) {
  const totalRow = db
    .prepare('SELECT COUNT(*) as count FROM agent_exec_result WHERE agent_id = ?')
    .get(agentId) as { count: number };
    const rows = db
      .prepare(
        'SELECT id, log, rebalance, new_allocation, short_report, error, created_at FROM agent_exec_result WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      )
      .all(agentId, limit, offset) as {
      id: string;
      log: string;
      rebalance: number | null;
      new_allocation: number | null;
      short_report: string | null;
      error: string | null;
      created_at: number;
    }[];
  return { rows, total: totalRow.count };
}
