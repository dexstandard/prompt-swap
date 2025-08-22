import { describe, it, expect } from 'vitest';

describe('sqlite db', () => {
  it('inserts and selects rows', async () => {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(':memory:');
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('alice');
    const row = db.prepare('SELECT name FROM test WHERE id = ?').get(1);
    expect(row).toMatchObject({ name: 'alice' });
    db.close();
  });
});
