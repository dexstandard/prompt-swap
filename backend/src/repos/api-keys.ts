import { db } from '../db/index.js';

export async function getAiKeyRow(id: string) {
  const { rows } = await db.query(
    "SELECT ak.id AS own_id, ak.api_key_enc AS own_enc, oak.id AS shared_id, oak.api_key_enc AS shared_enc, s.model AS shared_model FROM users u LEFT JOIN ai_api_keys ak ON ak.user_id = u.id AND ak.provider = 'openai' LEFT JOIN ai_api_key_shares s ON s.target_user_id = u.id LEFT JOIN ai_api_keys oak ON oak.user_id = s.owner_user_id AND oak.provider = 'openai' WHERE u.id = $1",
    [id],
  );
  const row = rows[0] as
    | {
        own_id?: string;
        own_enc?: string;
        shared_id?: string;
        shared_enc?: string;
        shared_model?: string;
      }
    | undefined;
  if (!row) return undefined;
  return {
    own: row.own_id
      ? { id: row.own_id, ai_api_key_enc: row.own_enc }
      : null,
    shared: row.shared_id
      ? {
          id: row.shared_id,
          ai_api_key_enc: row.shared_enc,
          model: row.shared_model ?? null,
        }
      : null,
  };
}

export async function setAiKey(id: string, enc: string) {
  await db.query(
    "INSERT INTO ai_api_keys (user_id, provider, api_key_enc) VALUES ($1, 'openai', $2) ON CONFLICT (user_id, provider) DO UPDATE SET api_key_enc = EXCLUDED.api_key_enc",
    [id, enc],
  );
}

export async function clearAiKey(id: string) {
  await db.query(
    "DELETE FROM ai_api_keys WHERE user_id = $1 AND provider = 'openai'",
    [id],
  );
}

export async function shareAiKey(
  ownerId: string,
  targetId: string,
  model: string,
) {
  await db.query(
    "INSERT INTO ai_api_key_shares (owner_user_id, target_user_id, model) VALUES ($1, $2, $3) ON CONFLICT (target_user_id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id, model = EXCLUDED.model",
    [ownerId, targetId, model],
  );
}

export async function revokeAiKeyShare(ownerId: string, targetId: string) {
  await db.query(
    'DELETE FROM ai_api_key_shares WHERE owner_user_id = $1 AND target_user_id = $2',
    [ownerId, targetId],
  );
}

export async function hasAiKeyShare(ownerId: string, targetId: string) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM ai_api_key_shares WHERE owner_user_id = $1 AND target_user_id = $2',
    [ownerId, targetId],
  );
  return rowCount > 0;
}

export async function getAiKeyShareTargets(ownerId: string) {
  const { rows } = await db.query(
    'SELECT target_user_id FROM ai_api_key_shares WHERE owner_user_id = $1',
    [ownerId],
  );
  return rows.map((r: { target_user_id: string }) => r.target_user_id);
}

export async function getBinanceKeyRow(id: string) {
  const { rows } = await db.query(
    "SELECT ek.id, ek.api_key_enc AS binance_api_key_enc, ek.api_secret_enc AS binance_api_secret_enc FROM users u LEFT JOIN exchange_keys ek ON ek.user_id = u.id AND ek.provider = 'binance' WHERE u.id = $1",
    [id],
  );
  return rows[0] as
    | { id?: string; binance_api_key_enc?: string; binance_api_secret_enc?: string }
    | undefined;
}

export async function setBinanceKey(
  id: string,
  keyEnc: string,
  secretEnc: string,
): Promise<void> {
  await db.query(
    "INSERT INTO exchange_keys (user_id, provider, api_key_enc, api_secret_enc) VALUES ($3, 'binance', $1, $2) ON CONFLICT (user_id, provider) DO UPDATE SET api_key_enc = EXCLUDED.api_key_enc, api_secret_enc = EXCLUDED.api_secret_enc",
    [keyEnc, secretEnc, id],
  );
}

export async function clearBinanceKey(id: string): Promise<void> {
  await db.query(
    "DELETE FROM exchange_keys WHERE user_id = $1 AND provider = 'binance'",
    [id],
  );
}

