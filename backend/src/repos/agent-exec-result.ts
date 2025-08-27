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
    'INSERT INTO agent_exec_result (id, agent_id, log, rebalance, new_allocation, short_report, error, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
  ).run(
    entry.id,
    entry.agentId,
    entry.log,
    entry.rebalance === undefined ? null : entry.rebalance,
    entry.newAllocation ?? null,
    entry.shortReport ?? null,
    entry.error ? JSON.stringify(entry.error) : null,
    entry.createdAt,
  );
}

export function getRecentExecResults(agentId: string, limit: number) {
  const rows = db
    .prepare(
      'SELECT rebalance, new_allocation, short_report, error FROM agent_exec_result WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
    )
    .all(agentId, limit) as {
      rebalance: boolean | null;
      new_allocation: number | null;
      short_report: string | null;
      error: string | null;
    }[];
  return rows.map((r) => ({
    ...(r.rebalance !== null ? { rebalance: r.rebalance } : {}),
    ...(r.new_allocation !== null ? { newAllocation: r.new_allocation } : {}),
    ...(r.short_report !== null ? { shortReport: r.short_report } : {}),
    ...(r.error !== null ? { error: JSON.parse(r.error) } : {}),
  }));
}

export function getAgentExecResults(agentId: string, limit: number, offset: number) {
  const totalRow = db
    .prepare('SELECT COUNT(*) as count FROM agent_exec_result WHERE agent_id = $1')
    .get(agentId) as { count: number };
  const rows = db
    .prepare(
        'SELECT id, log, rebalance, new_allocation, short_report, error, created_at FROM agent_exec_result WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      )
      .all(agentId, limit, offset) as {
        id: string;
        log: string;
        rebalance: boolean | null;
        new_allocation: number | null;
        short_report: string | null;
        error: string | null;
        created_at: number;
      }[];
  return { rows, total: totalRow.count };
}
