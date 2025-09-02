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

CREATE TABLE IF NOT EXISTS user_identities(
  user_id BIGINT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  sub TEXT NOT NULL,
  UNIQUE(provider, sub)
);

CREATE TABLE IF NOT EXISTS agents(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
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

CREATE TABLE IF NOT EXISTS agent_review_result(
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id),
  log TEXT,
  rebalance BOOLEAN,
  new_allocation REAL,
  short_report TEXT,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE TABLE IF NOT EXISTS limit_order(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  planned_json TEXT NOT NULL,
  status TEXT NOT NULL,
  review_result_id BIGINT REFERENCES agent_review_result(id),
  order_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS agent_review_raw_log(
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id),
  prompt TEXT,
  response TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS idx_agent_review_result_agent_id_created_at
  ON agent_review_result(agent_id, created_at);

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
