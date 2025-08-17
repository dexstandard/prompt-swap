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
CREATE TABLE IF NOT EXISTS agent_templates(
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT,
  token_a TEXT,
  token_b TEXT,
  target_allocation INTEGER,
  min_a_allocation INTEGER,
  min_b_allocation INTEGER,
  risk TEXT,
  rebalance TEXT,
  agent_instructions TEXT,
  use_search INTEGER DEFAULT 1,
  web_search_instructions TEXT
);

CREATE TABLE IF NOT EXISTS agents(
  id TEXT PRIMARY KEY,
  template_id TEXT,
  user_id TEXT,
  model TEXT,
  status TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS agent_exec_log(
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  log TEXT,
  created_at INTEGER
);
