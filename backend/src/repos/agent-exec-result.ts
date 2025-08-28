import { db } from '../db/index.js';

export interface ExecResultInsert {
  agentId: string;
  log: string;
  rebalance?: boolean;
  newAllocation?: number;
  shortReport?: string;
  error?: Record<string, unknown>;
}

export async function insertExecResult(entry: ExecResultInsert): Promise<string> {
  const { rows } = await db.query(
    'INSERT INTO agent_exec_result (agent_id, log, rebalance, new_allocation, short_report, error) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [
      entry.agentId,
      entry.log,
      entry.rebalance === undefined ? null : entry.rebalance,
      entry.newAllocation ?? null,
      entry.shortReport ?? null,
      entry.error ? JSON.stringify(entry.error) : null,
    ],
  );
  return rows[0].id as string;
}

export async function getRecentExecResults(agentId: string, limit: number) {
  const { rows } = await db.query(
    'SELECT rebalance, new_allocation, short_report, error FROM agent_exec_result WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
    [agentId, limit],
  );
  return (rows as {
    rebalance: boolean | null;
    new_allocation: number | null;
    short_report: string | null;
    error: string | null;
  }[]).map((r) => ({
    ...(r.rebalance !== null ? { rebalance: r.rebalance } : {}),
    ...(r.new_allocation !== null ? { newAllocation: r.new_allocation } : {}),
    ...(r.short_report !== null ? { shortReport: r.short_report } : {}),
    ...(r.error !== null ? { error: JSON.parse(r.error) } : {}),
  }));
}

export async function getAgentExecResults(agentId: string, limit: number, offset: number) {
  const totalRes = await db.query(
    'SELECT COUNT(*) as count FROM agent_exec_result WHERE agent_id = $1',
    [agentId],
  );
  const { rows } = await db.query(
    'SELECT id, log, rebalance, new_allocation, short_report, error, created_at FROM agent_exec_result WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [agentId, limit, offset],
  );
  return { rows: rows as any[], total: Number(totalRes.rows[0].count) };
}
