import { db } from '../db/index.js';
import { AgentStatus } from '../util/agents.js';

export interface AgentRow {
  id: string;
  user_id: string;
  model: string;
  status: string;
  created_at: string;
  start_balance: number | null;
  name: string;
  token_a: string;
  token_b: string;
  min_a_allocation: number;
  min_b_allocation: number;
  risk: string;
  review_interval: string;
  agent_instructions: string;
  manual_rebalance: boolean;
}

export function toApi(row: AgentRow) {
  return {
    id: row.id,
    userId: row.user_id,
    model: row.model,
    status: row.status,
    createdAt: Date.parse(row.created_at),
    startBalanceUsd: row.start_balance ?? null,
    name: row.name,
    tokenA: row.token_a,
    tokenB: row.token_b,
    minTokenAAllocation: row.min_a_allocation,
    minTokenBAllocation: row.min_b_allocation,
    risk: row.risk,
    reviewInterval: row.review_interval,
    agentInstructions: row.agent_instructions,
    manualRebalance: row.manual_rebalance,
  };
}

const baseSelect =
  'SELECT id, user_id, model, status, created_at, start_balance, name, token_a, token_b, ' +
  'min_a_allocation, min_b_allocation, risk, review_interval, ' +
  'agent_instructions, manual_rebalance FROM agents';

export async function getAgent(id: string): Promise<AgentRow | undefined> {
  const { rows } = await db.query(`${baseSelect} WHERE id = $1`, [id]);
  return rows[0] as AgentRow | undefined;
}

export async function getAgentsPaginated(
  userId: string,
  status: string | undefined,
  limit: number,
  offset: number,
) {
  if (status) {
    const where = 'WHERE user_id = $1 AND status = $2';
    const totalRes = await db.query(
      `SELECT COUNT(*) as count FROM agents ${where}`,
      [userId, status],
    );
    const { rows } = await db.query(
      `${baseSelect} ${where} LIMIT $3 OFFSET $4`,
      [userId, status, limit, offset],
    );
    return { rows: rows as AgentRow[], total: Number(totalRes.rows[0].count) };
  }
  const where = 'WHERE user_id = $1 AND status != $2';
  const totalRes = await db.query(
    `SELECT COUNT(*) as count FROM agents ${where}`,
    [userId, AgentStatus.Retired],
  );
  const { rows } = await db.query(
    `${baseSelect} ${where} LIMIT $3 OFFSET $4`,
    [userId, AgentStatus.Retired, limit, offset],
  );
  return { rows: rows as AgentRow[], total: Number(totalRes.rows[0].count) };
}

export async function findIdenticalDraftAgent(
  data: {
    userId: string;
    model: string;
    name: string;
    tokenA: string;
    tokenB: string;
    minTokenAAllocation: number;
    minTokenBAllocation: number;
    risk: string;
    reviewInterval: string;
    agentInstructions: string;
    manualRebalance: boolean;
  },
  excludeId?: string,
) {
  const query = `SELECT id, name FROM agents
     WHERE user_id = $1 AND status = 'draft' AND ($2::bigint IS NULL OR id != $2) AND model = $3 AND name = $4
       AND token_a = $5 AND token_b = $6
       AND min_a_allocation = $7 AND min_b_allocation = $8
       AND risk = $9 AND review_interval = $10 AND agent_instructions = $11 AND manual_rebalance = $12`;
  const params: unknown[] = [
    data.userId,
    excludeId ?? null,
    data.model,
    data.name,
    data.tokenA,
    data.tokenB,
    data.minTokenAAllocation,
    data.minTokenBAllocation,
    data.risk,
    data.reviewInterval,
    data.agentInstructions,
    data.manualRebalance,
  ];
  const { rows } = await db.query(query, params as any[]);
  return rows[0] as { id: string; name: string } | undefined;
}

export async function findActiveTokenConflicts(
  userId: string,
  tokenA: string,
  tokenB: string,
  excludeId?: string,
) {
  const query = `SELECT id, name, token_a, token_b FROM agents
       WHERE user_id = $1 AND status = 'active' AND ($2::bigint IS NULL OR id != $2)
         AND (token_a IN ($3, $4) OR token_b IN ($3, $4))`;
  const params: unknown[] = [userId, excludeId ?? null, tokenA, tokenB];
  const { rows } = await db.query(query, params as any[]);
  return rows as {
    id: string;
    name: string;
    token_a: string;
    token_b: string;
  }[];
}

export async function getUserApiKeys(userId: string) {
  const { rows } = await db.query(
    'SELECT ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = $1',
    [userId],
  );
  return rows[0] as
    | {
        ai_api_key_enc?: string;
        binance_api_key_enc?: string;
        binance_api_secret_enc?: string;
      }
    | undefined;
}

export async function insertAgent(data: {
  userId: string;
  model: string;
  status: string;
  startBalance: number | null;
  name: string;
  tokenA: string;
  tokenB: string;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
  manualRebalance: boolean;
}): Promise<AgentRow> {
  const { rows } = await db.query(
    `INSERT INTO agents (user_id, model, status, start_balance, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions, manual_rebalance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [
      data.userId,
      data.model,
      data.status,
      data.startBalance,
      data.name,
      data.tokenA,
      data.tokenB,
      data.minTokenAAllocation,
      data.minTokenBAllocation,
      data.risk,
      data.reviewInterval,
      data.agentInstructions,
      data.manualRebalance,
    ],
  );
  return rows[0] as AgentRow;
}


export async function updateAgent(data: {
  id: string;
  model: string;
  status: string;
  name: string;
  tokenA: string;
  tokenB: string;
  minTokenAAllocation: number;
  minTokenBAllocation: number;
  risk: string;
  reviewInterval: string;
  agentInstructions: string;
  startBalance: number | null;
  manualRebalance: boolean;
}): Promise<void> {
  await db.query(
    `UPDATE agents SET model = $1, status = $2, name = $3, token_a = $4, token_b = $5, min_a_allocation = $6, min_b_allocation = $7, risk = $8, review_interval = $9, agent_instructions = $10, start_balance = $11, manual_rebalance = $12 WHERE id = $13`,
    [
      data.model,
      data.status,
      data.name,
      data.tokenA,
      data.tokenB,
      data.minTokenAAllocation,
      data.minTokenBAllocation,
      data.risk,
      data.reviewInterval,
      data.agentInstructions,
      data.startBalance,
      data.manualRebalance,
      data.id,
    ],
  );
}

export async function deleteAgent(id: string): Promise<void> {
  await db.query(
    'UPDATE agents SET status = $1, start_balance = NULL WHERE id = $2',
    [AgentStatus.Retired, id],
  );
}

export async function startAgent(id: string, startBalance: number): Promise<void> {
  await db.query('UPDATE agents SET status = $1, start_balance = $2 WHERE id = $3', [
    AgentStatus.Active,
    startBalance,
    id,
  ]);
}

export async function stopAgent(id: string): Promise<void> {
  await db.query('UPDATE agents SET status = $1, start_balance = NULL WHERE id = $2', [
    AgentStatus.Inactive,
    id,
  ]);
}

export interface ActiveAgentRow {
  id: string;
  user_id: string;
  model: string;
  token_a: string;
  token_b: string;
  min_a_allocation: number;
  min_b_allocation: number;
  risk: string;
  review_interval: string;
  agent_instructions: string;
  ai_api_key_enc: string;
  manual_rebalance: boolean;
}

export async function getActiveAgents(options?: {
  agentId?: string;
  interval?: string;
}): Promise<ActiveAgentRow[]> {
  const sql = `SELECT a.id, a.user_id, a.model,
                      a.token_a, a.token_b,
                      a.min_a_allocation, a.min_b_allocation,
                      a.risk, a.review_interval, a.agent_instructions,
                      u.ai_api_key_enc, a.manual_rebalance
                 FROM agents a
                 JOIN users u ON u.id = a.user_id
                WHERE a.status = 'active'
                  AND ($1::bigint IS NULL OR a.id = $1)
                  AND ($2::text IS NULL OR a.review_interval = $2)`;
  const { rows } = await db.query(sql, [
    options?.agentId ?? null,
    options?.interval ?? null,
  ]);
  return rows as ActiveAgentRow[];
}
