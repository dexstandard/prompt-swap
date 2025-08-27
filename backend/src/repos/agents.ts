import { db } from '../db/index.js';

export interface AgentRow {
  id: string;
  user_id: string;
  model: string;
  status: string;
  created_at: number;
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
    createdAt: row.created_at,
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

export function getAgent(id: string) {
  return db
    .prepare(`${baseSelect} WHERE id = $1`)
    .get(id) as AgentRow | undefined;
}

export function getAgentsPaginated(
  userId: string,
  status: string | undefined,
  limit: number,
  offset: number,
) {
  const where = 'WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)';
  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM agents ${where}`)
    .get(userId, status ?? null) as { count: number };
  const rows = db
    .prepare(`${baseSelect} ${where} LIMIT $3 OFFSET $4`)
    .all(userId, status ?? null, limit, offset) as AgentRow[];
  return { rows, total: totalRow.count };
}

export function findIdenticalDraftAgent(
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
  return db.prepare(query).get(...params) as
    | { id: string; name: string }
    | undefined;
}

export function findActiveTokenConflicts(
  userId: string,
  tokenA: string,
  tokenB: string,
  excludeId?: string,
) {
  const query = `SELECT id, name, token_a, token_b FROM agents
       WHERE user_id = $1 AND status = 'active' AND ($2::bigint IS NULL OR id != $2)
         AND (token_a IN ($3, $4) OR token_b IN ($3, $4))`;
  const params: unknown[] = [userId, excludeId ?? null, tokenA, tokenB];
  return db.prepare(query).all(...params) as {
    id: string;
    name: string;
    token_a: string;
    token_b: string;
  }[];
}

export function getUserApiKeys(userId: string) {
  return db
    .prepare(
      'SELECT ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = $1',
    )
    .get(userId) as
    | {
        ai_api_key_enc?: string;
        binance_api_key_enc?: string;
        binance_api_secret_enc?: string;
      }
    | undefined;
}

export function insertAgent(data: {
  id: string;
  userId: string;
  model: string;
  status: string;
  createdAt: number;
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
}) {
  db.prepare(
    `INSERT INTO agents (id, user_id, model, status, created_at, start_balance, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions, manual_rebalance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
  ).run(
    data.id,
    data.userId,
    data.model,
    data.status,
    data.createdAt,
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
  );
}


export function updateAgent(data: {
  id: string;
  userId: string;
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
}) {
  db.prepare(
    `UPDATE agents SET user_id = $1, model = $2, status = $3, name = $4, token_a = $5, token_b = $6, min_a_allocation = $7, min_b_allocation = $8, risk = $9, review_interval = $10, agent_instructions = $11, start_balance = $12, manual_rebalance = $13 WHERE id = $14`,
  ).run(
    data.userId,
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
  );
}

export function deleteAgent(id: string) {
  db.prepare('DELETE FROM agents WHERE id = $1').run(id);
}

export function startAgent(id: string, startBalance: number) {
  db
    .prepare('UPDATE agents SET status = $1, start_balance = $2 WHERE id = $3')
    .run('active', startBalance, id);
}

export function stopAgent(id: string) {
  db
    .prepare('UPDATE agents SET status = $1, start_balance = NULL WHERE id = $2')
    .run('inactive', id);
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

export function getActiveAgents(options?: {
  agentId?: string;
  interval?: string;
}): ActiveAgentRow[] {
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
  return db
    .prepare(sql)
    .all(options?.agentId ?? null, options?.interval ?? null) as ActiveAgentRow[];
}
