import { db } from '../db/index.js';

export async function getAiKeyRow(id: string) {
  const { rows } = await db.query(
    "SELECT ak.id, ak.api_key_enc AS ai_api_key_enc FROM users u LEFT JOIN ai_api_keys ak ON ak.user_id = u.id AND ak.provider = 'openai' WHERE u.id = $1",
    [id],
  );
  return rows[0] as { id?: string; ai_api_key_enc?: string } | undefined;
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

