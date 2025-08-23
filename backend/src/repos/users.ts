import { db } from '../db/index.js';
import { decrypt } from '../util/crypto.js';
import { env } from '../util/env.js';

export interface UserRow {
  totp_secret?: string;
  is_totp_enabled?: number;
  role: string;
  is_enabled: number;
}

export function getUser(id: string) {
  const row = db
    .prepare(
      'SELECT totp_secret_enc, is_totp_enabled, role, is_enabled FROM users WHERE id = ?'
    )
    .get(id) as {
      totp_secret_enc?: string;
      is_totp_enabled?: number;
      role: string;
      is_enabled: number;
    } | undefined;
  if (!row) return undefined;
  return {
    totp_secret: row.totp_secret_enc
      ? decrypt(row.totp_secret_enc, env.KEY_PASSWORD)
      : undefined,
    is_totp_enabled: row.is_totp_enabled,
    role: row.role,
    is_enabled: row.is_enabled,
  };
}

export function insertUser(id: string, emailEnc: string | null) {
  db.prepare(
    "INSERT INTO users (id, is_auto_enabled, role, is_enabled, email_enc) VALUES (?, 0, 'user', 1, ?)"
  ).run(id, emailEnc);
}

export function setUserEmail(id: string, emailEnc: string) {
  db.prepare('UPDATE users SET email_enc = ? WHERE id = ?').run(emailEnc, id);
}

export function listUsers() {
  return db
    .prepare('SELECT id, role, is_enabled, email_enc, created_at FROM users')
    .all() as {
      id: string;
      role: string;
      is_enabled: number;
      email_enc?: string;
      created_at: number;
    }[];
}

export function setUserEnabled(id: string, enabled: boolean) {
  db.prepare('UPDATE users SET is_enabled = ? WHERE id = ?').run(
    enabled ? 1 : 0,
    id,
  );
}
