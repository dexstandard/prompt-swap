import { db } from '../db/index.js';
import { encrypt, decrypt } from '../util/crypto.js';
import { env } from '../util/env.js';

export interface UserRow {
  totp_secret?: string;
  is_totp_enabled?: boolean;
  role: string;
  is_enabled: boolean;
}

export async function getUser(id: string) {
  const { rows } = await db.query(
    'SELECT totp_secret_enc, is_totp_enabled, role, is_enabled FROM users WHERE id = $1',
    [id],
  );
  const row = rows[0] as {
    totp_secret_enc?: string;
    is_totp_enabled?: boolean;
    role: string;
    is_enabled: boolean;
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

export async function insertUser(id: string, emailEnc: string | null): Promise<void> {
  await db.query(
    "INSERT INTO users (id, role, is_enabled, email_enc) VALUES ($1, 'user', true, $2)",
    [id, emailEnc],
  );
}

export async function setUserEmail(id: string, emailEnc: string): Promise<void> {
  await db.query('UPDATE users SET email_enc = $1 WHERE id = $2', [emailEnc, id]);
}

export async function listUsers() {
  const { rows } = await db.query(
    'SELECT id, role, is_enabled, email_enc, created_at FROM users',
  );
  return rows as {
    id: string;
    role: string;
    is_enabled: boolean;
    email_enc?: string;
    created_at: string;
  }[];
}

export async function setUserEnabled(id: string, enabled: boolean): Promise<void> {
  await db.query('UPDATE users SET is_enabled = $1 WHERE id = $2', [enabled, id]);
}

export async function getUserTotpStatus(id: string) {
  const { rows } = await db.query(
    'SELECT is_totp_enabled FROM users WHERE id = $1',
    [id],
  );
  const row = rows[0] as { is_totp_enabled?: boolean } | undefined;
  return !!row?.is_totp_enabled;
}

export async function setUserTotpSecret(id: string, secret: string): Promise<void> {
  const enc = encrypt(secret, env.KEY_PASSWORD);
  await db.query(
    'UPDATE users SET totp_secret_enc = $1, is_totp_enabled = true WHERE id = $2',
    [enc, id],
  );
}

export async function getUserTotpSecret(id: string) {
  const { rows } = await db.query(
    'SELECT totp_secret_enc FROM users WHERE id = $1',
    [id],
  );
  const row = rows[0] as { totp_secret_enc?: string } | undefined;
  if (!row?.totp_secret_enc) return undefined;
  return decrypt(row.totp_secret_enc, env.KEY_PASSWORD);
}

export async function clearUserTotp(id: string): Promise<void> {
  await db.query(
    'UPDATE users SET totp_secret_enc = NULL, is_totp_enabled = false WHERE id = $1',
    [id],
  );
}
