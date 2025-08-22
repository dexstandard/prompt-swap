import { beforeEach, afterAll } from 'vitest';
import { db, migrate } from '../src/db/index.js';

beforeEach(() => {
  migrate();
});

afterAll(() => {
  db.close();
});
