import { beforeAll, beforeEach, afterAll } from 'vitest';

process.env.DATABASE_URL ??=
  'postgres://postgres:postgres@localhost:5432/promptswap_test';

const { db, migrate } = await import('../src/db/index.js');

beforeAll(async () => {
  await migrate();
});

beforeEach(async () => {
  await db.query(
    'TRUNCATE TABLE agent_review_raw_log, agent_review_result, limit_order, agent_tokens, agents, ai_api_keys, exchange_keys, user_identities, users RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await db.end();
});
