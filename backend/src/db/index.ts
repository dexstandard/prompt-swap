import { Pool } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../util/env.js';

interface DB {
  prepare<TArgs extends any[], TResult>(sql: string): any;
  query: (text: string, params?: any[]) => Promise<any>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const db = new Pool({ connectionString: env.DATABASE_URL }) as unknown as DB;

export async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
}
