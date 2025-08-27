import { db } from '../db/index.js';

export function getAiKeyRow(id: string) {
  return db
    .prepare('SELECT ai_api_key_enc FROM users WHERE id = $1')
    .get(id) as { ai_api_key_enc?: string } | undefined;
}

export function setAiKey(id: string, enc: string) {
  db.prepare('UPDATE users SET ai_api_key_enc = $1 WHERE id = $2').run(enc, id);
}

export function clearAiKey(id: string) {
  db.prepare('UPDATE users SET ai_api_key_enc = NULL WHERE id = $1').run(id);
}

export function getBinanceKeyRow(id: string) {
  return db
    .prepare(
      'SELECT binance_api_key_enc, binance_api_secret_enc FROM users WHERE id = $1',
    )
    .get(id) as
    | { binance_api_key_enc?: string; binance_api_secret_enc?: string }
    | undefined;
}

export function setBinanceKey(
  id: string,
  keyEnc: string,
  secretEnc: string,
) {
  db.prepare(
    'UPDATE users SET binance_api_key_enc = $1, binance_api_secret_enc = $2 WHERE id = $3',
  ).run(keyEnc, secretEnc, id);
}

export function clearBinanceKey(id: string) {
  db
    .prepare(
      'UPDATE users SET binance_api_key_enc = NULL, binance_api_secret_enc = NULL WHERE id = $1',
    )
    .run(id);
}

