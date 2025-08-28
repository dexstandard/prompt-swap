import { db } from '../db/index.js';

export async function getAiKeyRow(id: number) {
  const { rows } = await db.query('SELECT ai_api_key_enc FROM users WHERE id = $1', [id]);
  return rows[0] as { ai_api_key_enc?: string } | undefined;
}

export async function setAiKey(id: number, enc: string) {
  await db.query('UPDATE users SET ai_api_key_enc = $1 WHERE id = $2', [enc, id]);
}

export async function clearAiKey(id: number) {
  await db.query('UPDATE users SET ai_api_key_enc = NULL WHERE id = $1', [id]);
}

export async function getBinanceKeyRow(id: number) {
  const { rows } = await db.query(
    'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = $1',
    [id],
  );
  return rows[0] as
    | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
    | undefined;
}

export async function setBinanceKey(
  id: number,
  keyEnc: string,
  secretEnc: string,
): Promise<void> {
  await db.query(
    'UPDATE users SET binance_api_key_enc = $1, binance_api_secret_enc = $2 WHERE id = $3',
    [keyEnc, secretEnc, id],
  );
}

export async function clearBinanceKey(id: number): Promise<void> {
  await db.query(
    'UPDATE users SET binance_api_key_enc = NULL, binance_api_secret_enc = NULL WHERE id = $1',
    [id],
  );
}

