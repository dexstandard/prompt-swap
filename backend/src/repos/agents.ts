import { db } from '../db/index.js';

export interface AgentRow {
  id: string;
  user_id: string;
  model: string;
  status: string;
  created_at: number;
  name: string;
  token_a: string;
  token_b: string;
  min_a_allocation: number;
  min_b_allocation: number;
  risk: string;
  review_interval: string;
  agent_instructions: string;
}

export interface ExecLogRow {
  id: string;
  log: string;
  created_at: number;
}

export function toApi(row: AgentRow) {
  return {
    id: row.id,
    userId: row.user_id,
    model: row.model,
    status: row.status,
    createdAt: row.created_at,
    name: row.name,
    tokenA: row.token_a,
    tokenB: row.token_b,
    minTokenAAllocation: row.min_a_allocation,
    minTokenBAllocation: row.min_b_allocation,
    risk: row.risk,
    reviewInterval: row.review_interval,
    agentInstructions: row.agent_instructions,
  };
}

const baseSelect =
  'SELECT id, user_id, model, status, created_at, name, token_a, token_b, ' +
  'min_a_allocation, min_b_allocation, risk, review_interval, ' +
  'agent_instructions FROM agents';

export function getAgent(id: string) {
  return db
    .prepare<[string], AgentRow>(`${baseSelect} WHERE id = ?`)
    .get(id) as AgentRow | undefined;
}

export function getAgentsPaginated(
  userId: string,
  status: string | undefined,
  limit: number,
  offset: number,
) {
  let where = 'WHERE user_id = ?';
  const params: unknown[] = [userId];
  if (status === 'active' || status === 'inactive' || status === 'draft') {
    where += ' AND status = ?';
    params.push(status);
  }
  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM agents ${where}`)
    .get(...params) as { count: number };
  const rows = db
    .prepare(`${baseSelect} ${where} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as AgentRow[];
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
  },
  excludeId?: string,
) {
  const query = `SELECT id, name FROM agents
     WHERE user_id = ? AND status = 'draft'${excludeId ? ' AND id != ?' : ''} AND model = ? AND name = ?
       AND token_a = ? AND token_b = ?
       AND min_a_allocation = ? AND min_b_allocation = ?
       AND risk = ? AND review_interval = ? AND agent_instructions = ?`;
  const params: unknown[] = [
    data.userId,
    ...(excludeId ? [excludeId] : []),
    data.model,
    data.name,
    data.tokenA,
    data.tokenB,
    data.minTokenAAllocation,
    data.minTokenBAllocation,
    data.risk,
    data.reviewInterval,
    data.agentInstructions,
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
       WHERE user_id = ? AND status = 'active'${excludeId ? ' AND id != ?' : ''}
         AND (token_a IN (?, ?) OR token_b IN (?, ?))`;
  const params: unknown[] = [userId];
  if (excludeId) params.push(excludeId);
  params.push(tokenA, tokenB, tokenA, tokenB);
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
      'SELECT ai_api_key_enc, binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = ?',
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
}) {
  db.prepare(
    `INSERT INTO agents (id, user_id, model, status, created_at, start_balance, name, token_a, token_b, min_a_allocation, min_b_allocation, risk, review_interval, agent_instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  );
}

export function getAgentExecLog(
  agentId: string,
  limit: number,
  offset: number,
) {
  const totalRow = db
    .prepare('SELECT COUNT(*) as count FROM agent_exec_log WHERE agent_id = ?')
    .get(agentId) as { count: number };
  const rows = db
    .prepare(
      'SELECT id, log, created_at FROM agent_exec_log WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    )
    .all(agentId, limit, offset) as ExecLogRow[];
  return { rows, total: totalRow.count };
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
}) {
  db.prepare(
    `UPDATE agents SET user_id = ?, model = ?, status = ?, name = ?, token_a = ?, token_b = ?, min_a_allocation = ?, min_b_allocation = ?, risk = ?, review_interval = ?, agent_instructions = ?, start_balance = ? WHERE id = ?`,
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
    data.id,
  );
}

export function deleteAgent(id: string) {
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
}

export function startAgent(id: string, startBalance: number) {
  db
    .prepare('UPDATE agents SET status = ?, start_balance = ? WHERE id = ?')
    .run('active', startBalance, id);
}

export function stopAgent(id: string) {
  db
    .prepare('UPDATE agents SET status = ?, start_balance = NULL WHERE id = ?')
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
}

export function getActiveAgents(agentId?: string): ActiveAgentRow[] {
  const sql = `SELECT a.id, a.user_id, a.model,
                      a.token_a, a.token_b,
                      a.min_a_allocation, a.min_b_allocation,
                      a.risk, a.review_interval, a.agent_instructions,
                      u.ai_api_key_enc
                 FROM agents a
                 JOIN users u ON u.id = a.user_id
                WHERE a.status = 'active' ${agentId ? 'AND a.id = ?' : ''}`;
  return db.prepare(sql).all(agentId ? [agentId] : []) as ActiveAgentRow[];
}
