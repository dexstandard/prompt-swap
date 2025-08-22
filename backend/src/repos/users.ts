import { db } from '../db/index.js';

export function getTotpRow(id: string) {
  return db
    .prepare('SELECT totp_secret, is_totp_enabled FROM users WHERE id = ?')
    .get(id) as { totp_secret?: string; is_totp_enabled?: number } | undefined;
}

export function insertUser(id: string) {
  db.prepare('INSERT INTO users (id, is_auto_enabled) VALUES (?, 0)').run(id);
}

