import { beforeAll, beforeEach, afterAll } from 'vitest';
import { db, migrate } from '../src/db/index.js';

beforeAll(async () => {
  await migrate();
});

beforeEach(async () => {
  await db.query(
    'TRUNCATE TABLE agent_exec_log, agent_exec_result, executions, agents, user_identities, users RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await db.end();
});
