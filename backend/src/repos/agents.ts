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
                      t.token_a, t.token_b, t.target_allocation,
                      t.min_a_allocation, t.min_b_allocation,
                      t.risk, t.review_interval, t.agent_instructions,
                      u.ai_api_key_enc
                 FROM agents a
                 JOIN agent_templates t ON a.template_id = t.id
                 JOIN users u ON u.id = a.user_id
                WHERE a.status = 'active' ${agentId ? 'AND a.id = ?' : ''}`;
  return db.prepare(sql).all(agentId ? [agentId] : []) as ActiveAgentRow[];
}
