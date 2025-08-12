CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  is_auto_enabled INTEGER,
  policy_json TEXT,
  session_key_expires_at INTEGER,
  ai_api_key_enc TEXT,
  binance_api_key_enc TEXT
);

CREATE TABLE IF NOT EXISTS executions(
  id TEXT PRIMARY KEY,
  user_id TEXT,
  planned_json TEXT,
  sim_json TEXT,
  tx_hash TEXT,
  created_at INTEGER
);
