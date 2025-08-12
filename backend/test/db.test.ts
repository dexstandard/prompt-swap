import { describe, it, expect } from 'vitest';

// Use in-memory database for testing
process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';

const { db } = await import('../src/db/index.js');

describe('sqlite db', () => {
  it('inserts and selects rows', () => {
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('alice');
    const row = db.prepare('SELECT name FROM test WHERE id = ?').get(1);
    expect(row).toMatchObject({ name: 'alice' });
    db.close();
  });
});
