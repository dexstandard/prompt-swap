import { describe, it, expect } from 'vitest';
import buildServer from '../src/server.js';
import { db } from '../src/db/index.js';
import { encrypt } from '../src/util/crypto.js';
import { env } from '../src/util/env.js';

describe('admin user routes', () => {
  it('lists users for admin only', async () => {
    const app = await buildServer();
    db.prepare(
      "INSERT INTO users (id, is_auto_enabled, role, is_enabled, email_enc) VALUES ('admin1', 0, 'admin', 1, ?)"
    ).run(encrypt('admin@example.com', env.KEY_PASSWORD));
    db.prepare(
      "INSERT INTO users (id, is_auto_enabled, role, is_enabled, email_enc) VALUES ('user1', 0, 'user', 1, ?)"
    ).run(encrypt('user1@example.com', env.KEY_PASSWORD));

    const resForbidden = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { 'x-user-id': 'user1' },
    });
    expect(resForbidden.statusCode).toBe(403);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { 'x-user-id': 'admin1' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any[];
    const user = body.find((u) => u.id === 'user1');
    expect(user.email).toBe('user1@example.com');
    expect(typeof user.createdAt).toBe('number');
    await app.close();
  });

  it('enables and disables users', async () => {
    const app = await buildServer();
    db.prepare(
      "INSERT INTO users (id, is_auto_enabled, role, is_enabled) VALUES ('admin2', 0, 'admin', 1)"
    ).run();
    db.prepare(
      "INSERT INTO users (id, is_auto_enabled, role, is_enabled) VALUES ('user2', 0, 'user', 1)"
    ).run();

    const resDisable = await app.inject({
      method: 'POST',
      url: '/api/users/user2/disable',
      headers: { 'x-user-id': 'admin2' },
    });
    expect(resDisable.statusCode).toBe(200);
    let row = db
      .prepare('SELECT is_enabled FROM users WHERE id = ?')
      .get('user2') as { is_enabled: number };
    expect(row.is_enabled).toBe(0);

    const resEnable = await app.inject({
      method: 'POST',
      url: '/api/users/user2/enable',
      headers: { 'x-user-id': 'admin2' },
    });
    expect(resEnable.statusCode).toBe(200);
    row = db
      .prepare('SELECT is_enabled FROM users WHERE id = ?')
      .get('user2') as { is_enabled: number };
    expect(row.is_enabled).toBe(1);

    await app.close();
  });
});
