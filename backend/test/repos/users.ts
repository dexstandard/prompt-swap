import { db } from '../../src/db/index.js';
import {
  insertUser as insertUserProd,
  setUserEmail,
  setUserEnabled,
} from '../../src/repos/users.js';

export function insertUser(id: string, emailEnc?: string | null) {
  insertUserProd(id, emailEnc ?? null);
}
export { setUserEmail, setUserEnabled };

export function insertAdminUser(id: string, emailEnc?: string | null) {
  db.prepare(
    "INSERT INTO users (id, role, is_enabled, email_enc) VALUES (?, 'admin', true, ?)"
  ).run(id, emailEnc ?? null);
}

export function clearUsers() {
  db.prepare('DELETE FROM users').run();
}

export function getUserEmailEnc(id: string) {
  return db
    .prepare('SELECT email_enc FROM users WHERE id = ?')
    .get(id) as { email_enc?: string } | undefined;
}
