CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  is_auto_enabled INTEGER,
  policy_json TEXT,
  session_key_expires_at INTEGER,
  ai_api_key_enc TEXT,
  binance_api_key_enc TEXT,
  binance_api_secret_enc TEXT,
  totp_secret TEXT,
  is_totp_enabled INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS executions(
  id TEXT PRIMARY KEY,
  user_id TEXT,
  planned_json TEXT,
  sim_json TEXT,
  tx_hash TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS agents(
  id TEXT PRIMARY KEY,
  user_id TEXT,
  model TEXT,
  status TEXT,
  created_at INTEGER,
  start_balance REAL,
  name TEXT,
  token_a TEXT,
  token_b TEXT,
  min_a_allocation INTEGER,
  min_b_allocation INTEGER,
  risk TEXT,
  review_interval TEXT,
  agent_instructions TEXT
);

CREATE TABLE IF NOT EXISTS agent_exec_log(
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  prompt TEXT,
  response TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS agent_exec_result(
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  log TEXT,
  rebalance INTEGER,
  new_allocation REAL,
  short_report TEXT,
  error TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_exec_result_agent_id_created_at
  ON agent_exec_result(agent_id, created_at);

-- Indexes to optimize duplicate detection queries
CREATE INDEX IF NOT EXISTS idx_agents_draft_all_fields
  ON agents(
    user_id, model, name, token_a, token_b,
    min_a_allocation, min_b_allocation,
    risk, review_interval, agent_instructions
  )
  WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS idx_agents_active_token_a
  ON agents(user_id, token_a)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_agents_active_token_b
  ON agents(user_id, token_b)
  WHERE status = 'active';
