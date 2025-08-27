CREATE TABLE IF NOT EXISTS users(
  id BIGSERIAL PRIMARY KEY,
  is_auto_enabled INTEGER,
  role TEXT DEFAULT 'user',
  is_enabled INTEGER DEFAULT 1,
  policy_json TEXT,
  session_key_expires_at BIGINT,
  ai_api_key_enc TEXT,
  binance_api_key_enc TEXT,
  binance_api_secret_enc TEXT,
  totp_secret_enc TEXT,
  is_totp_enabled INTEGER DEFAULT 0,
  email_enc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS executions(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  planned_json TEXT,
  status TEXT,
  exec_result_id BIGINT,
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  model TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  start_balance REAL,
  name TEXT,
  token_a TEXT,
  token_b TEXT,
  min_a_allocation INTEGER,
  min_b_allocation INTEGER,
  risk TEXT,
  review_interval TEXT,
  agent_instructions TEXT,
  manual_rebalance INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_exec_log(
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT,
  prompt TEXT,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_exec_result(
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT,
  log TEXT,
  rebalance INTEGER,
  new_allocation REAL,
  short_report TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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
