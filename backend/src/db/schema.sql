CREATE TABLE IF NOT EXISTS users(
  id BIGSERIAL PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ai_api_key_enc TEXT,
  binance_api_key_enc TEXT,
  binance_api_secret_enc TEXT,
  totp_secret_enc TEXT,
  is_totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enc TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS executions(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  planned_json TEXT NOT NULL,
  status TEXT NOT NULL,
  exec_result_id BIGINT,
  order_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS agents(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  start_balance REAL,
  name VARCHAR(100),
  token_a VARCHAR(20) NOT NULL,
  token_b VARCHAR(20) NOT NULL,
  min_a_allocation INTEGER,
  min_b_allocation INTEGER,
  risk VARCHAR(20) NOT NULL,
  review_interval VARCHAR(20) NOT NULL,
  agent_instructions VARCHAR(1000) NOT NULL,
  manual_rebalance BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS agent_exec_log(
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL,
  prompt TEXT,
  response TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS agent_exec_result(
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL,
  log TEXT,
  rebalance BOOLEAN,
  new_allocation REAL,
  short_report TEXT,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
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
