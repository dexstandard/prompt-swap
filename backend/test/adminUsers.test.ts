import { describe, it, expect } from 'vitest';
import buildServer from '../src/server.js';
import { encrypt } from '../src/util/crypto.js';
import { env } from '../src/util/env.js';
import { insertAdminUser, insertUser } from './repos/users.js';
import { getUser } from '../src/repos/users.js';

describe('admin user routes', () => {
  it('lists users for admin only', async () => {
    const app = await buildServer();
    const adminId = await insertAdminUser('admin1', encrypt('admin@example.com', env.KEY_PASSWORD));
    const userId = await insertUser('1', encrypt('user1@example.com', env.KEY_PASSWORD));

    const resForbidden = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { 'x-user-id': userId },
    });
    expect(resForbidden.statusCode).toBe(403);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { 'x-user-id': adminId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any[];
    const user = body.find((u) => u.id === userId);
    expect(user.email).toBe('user1@example.com');
    expect(typeof user.createdAt).toBe('string');
    await app.close();
  });

  it('enables and disables users', async () => {
    const app = await buildServer();
    const adminId = await insertAdminUser('admin2');
    const userId = await insertUser('2');

    const resDisable = await app.inject({
      method: 'POST',
      url: `/api/users/${userId}/disable`,
      headers: { 'x-user-id': adminId },
    });
    expect(resDisable.statusCode).toBe(200);
    let row = await getUser(userId);
    expect(row?.is_enabled).toBe(false);

    const resEnable = await app.inject({
      method: 'POST',
      url: `/api/users/${userId}/enable`,
      headers: { 'x-user-id': adminId },
    });
    expect(resEnable.statusCode).toBe(200);
    row = await getUser(userId);
    expect(row?.is_enabled).toBe(true);

    await app.close();
  });
});
