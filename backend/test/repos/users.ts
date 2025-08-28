import { db } from '../../src/db/index.js';
import {
  insertUser as insertUserProd,
  setUserEmail,
  setUserEnabled,
} from '../../src/repos/users.js';

export async function insertUser(_id?: string, emailEnc?: string | null) {
  return insertUserProd(emailEnc ?? null);
}
export { setUserEmail, setUserEnabled };

export async function insertAdminUser(_id?: string, emailEnc?: string | null) {
  const { rows } = await db.query(
    "INSERT INTO users (role, is_enabled, email_enc) VALUES ('admin', true, $1) RETURNING id",
    [emailEnc ?? null],
  );
  return Number(rows[0].id);
}

export async function clearUsers() {
  await db.query('DELETE FROM users');
}

export async function getUserEmailEnc(id: number) {
  const { rows } = await db.query('SELECT email_enc FROM users WHERE id = $1', [id]);
  return rows[0] as { email_enc?: string } | undefined;
}
