import { db } from '../db/index.js';
import { decrypt } from '../util/crypto.js';
import { env } from '../util/env.js';

export interface UserIdentityRow {
  id: string;
  role: string;
  is_enabled: boolean;
  totp_secret?: string;
  is_totp_enabled?: boolean;
}

export async function findUserByIdentity(provider: string, sub: string) {
  const { rows } = await db.query(
    'SELECT u.id, u.role, u.is_enabled, u.totp_secret_enc, u.is_totp_enabled FROM user_identities ui JOIN users u ON ui.user_id = u.id WHERE ui.provider = $1 AND ui.sub = $2',
    [provider, sub],
  );
  const row = rows[0] as {
    id: string;
    role: string;
    is_enabled: boolean;
    totp_secret_enc?: string;
    is_totp_enabled?: boolean;
  } | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    role: row.role,
    is_enabled: row.is_enabled,
    totp_secret: row.totp_secret_enc
      ? decrypt(row.totp_secret_enc, env.KEY_PASSWORD)
      : undefined,
    is_totp_enabled: row.is_totp_enabled,
  } as UserIdentityRow;
}

export async function insertUserIdentity(
  userId: string,
  provider: string,
  sub: string,
): Promise<void> {
  await db.query(
    'INSERT INTO user_identities (user_id, provider, sub) VALUES ($1, $2, $3)',
    [userId, provider, sub],
  );
}
