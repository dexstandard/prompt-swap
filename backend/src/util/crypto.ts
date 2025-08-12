import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-ctr';
const IV_LENGTH = 16; // AES block size
const SALT_LENGTH = 16;

export function encrypt(text: string, password: string): string {
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, 32);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

export function decrypt(payload: string, password: string): string {
  const buffer = Buffer.from(payload, 'base64');
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH);
  const key = scryptSync(password, salt, 32);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
