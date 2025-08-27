import { beforeEach, afterAll } from 'vitest';
import { db, migrate } from '../src/db/index.js';

beforeEach(async () => {
  await migrate();
});

afterAll(async () => {
  await db.end();
});
