import { db } from '../../src/db/index.js';
import {
  insertUser as insertUserProd,
  setUserEmail,
  setUserEnabled,
} from '../../src/repos/users.js';

export async function insertUser(id: string, emailEnc?: string | null) {
  await insertUserProd(id, emailEnc ?? null);
}
export { setUserEmail, setUserEnabled };

export async function insertAdminUser(id: string, emailEnc?: string | null) {
  await db.query(
    "INSERT INTO users (id, role, is_enabled, email_enc) VALUES ($1, 'admin', true, $2)",
    [id, emailEnc ?? null],
  );
}

export async function clearUsers() {
  await db.query('DELETE FROM users');
}

export async function getUserEmailEnc(id: string) {
  const { rows } = await db.query('SELECT email_enc FROM users WHERE id = $1', [id]);
  return rows[0] as { email_enc?: string } | undefined;
}
