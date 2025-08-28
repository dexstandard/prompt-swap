import { beforeAll, beforeEach, afterAll } from 'vitest';

process.env.DATABASE_URL ??=
  'postgres://postgres:postgres@localhost:5432/promptswap_test';

const { db, migrate } = await import('../src/db/index.js');

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
