import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

describe('sqlite db', () => {
  it('inserts and selects rows', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('alice');
    const row = db.prepare('SELECT name FROM test WHERE id = ?').get(1);
    expect(row).toMatchObject({ name: 'alice' });
    db.close();
  });
});
