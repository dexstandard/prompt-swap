import { beforeAll, beforeEach, afterAll } from 'vitest';

let container: import('@testcontainers/postgresql').StartedPostgreSqlContainer | undefined;

if (!process.env.DATABASE_URL && process.env.USE_TESTCONTAINERS !== '0') {
  try {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    container = await new PostgreSqlContainer()
      .withDatabase('promptswap_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    process.env.DATABASE_URL = container.getConnectionUri();
  } catch {
    console.warn('Failed to start PostgreSQL testcontainer, falling back to local instance');
  }
}

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
  if (container) {
    await container.stop();
  }
});
