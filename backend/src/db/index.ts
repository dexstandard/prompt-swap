import { Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../util/env.js';

interface DB {
  prepare: (sql: string) => any;
  query: (text: string, params?: any[]) => Promise<any>;
  end: () => Promise<void>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db: DB = {
  query: (text, params) => pool.query(text, params),
  prepare: (sql: string) => ({
    run: (...params: any[]) => pool.query(sql, params),
    all: (...params: any[]) =>
      pool.query(sql, params).then((res) => res.rows),
    get: (...params: any[]) =>
      pool.query(sql, params).then((res) => res.rows[0]),
  }),
  end: () => pool.end(),
};

export async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
}
