import { db } from '../db/index.js';

export interface ActiveAgentRow {
  id: string;
  user_id: string;
  model: string;
  token_a: string;
  token_b: string;
  target_allocation: number;
  min_a_allocation: number;
  min_b_allocation: number;
  risk: string;
  review_interval: string;
  agent_instructions: string;
  ai_api_key_enc: string;
}

export function getActiveAgents(agentId?: string): ActiveAgentRow[] {
  const sql = `SELECT a.id, a.user_id, a.model,
                      a.token_a, a.token_b, a.target_allocation,
                      a.min_a_allocation, a.min_b_allocation,
                      a.risk, a.review_interval, a.agent_instructions,
                      u.ai_api_key_enc
                 FROM agents a
                 JOIN users u ON u.id = a.user_id
                WHERE a.status = 'active' ${agentId ? 'AND a.id = ?' : ''}`;
  return db.prepare(sql).all(agentId ? [agentId] : []) as ActiveAgentRow[];
}
