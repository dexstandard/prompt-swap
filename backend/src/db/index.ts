import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../util/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const db = new Database(env.DATABASE_URL);

export function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  db.exec(
    'UPDATE token_indexes SET token_a = UPPER(token_a), token_b = UPPER(token_b)'
  );
}
