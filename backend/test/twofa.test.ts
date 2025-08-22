import { describe, it, expect } from 'vitest';
import { db } from '../src/db/index.js';
import buildServer from '../src/server.js';
import { authenticator } from 'otplib';

describe('2fa routes', () => {
  it('enables and disables 2fa', async () => {
    db.prepare('INSERT INTO users (id, is_auto_enabled) VALUES (?,0)').run('user1');
    const app = await buildServer();

    const setupRes = await app.inject({
      method: 'GET',
      url: '/api/2fa/setup',
      headers: { 'x-user-id': 'user1' },
    });
    expect(setupRes.statusCode).toBe(200);
    const { secret } = setupRes.json() as { secret: string };

    const token = authenticator.generate(secret);
    const enableRes = await app.inject({
      method: 'POST',
      url: '/api/2fa/enable',
      headers: { 'x-user-id': 'user1' },
      payload: { token, secret },
    });
    expect(enableRes.statusCode).toBe(200);

    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/2fa/status',
      headers: { 'x-user-id': 'user1' },
    });
    expect(statusRes.json()).toEqual({ enabled: true });

    const disableRes = await app.inject({
      method: 'POST',
      url: '/api/2fa/disable',
      headers: { 'x-user-id': 'user1' },
      payload: { token: authenticator.generate(secret) },
    });
    expect(disableRes.statusCode).toBe(200);

    const statusRes2 = await app.inject({
      method: 'GET',
      url: '/api/2fa/status',
      headers: { 'x-user-id': 'user1' },
    });
    expect(statusRes2.json()).toEqual({ enabled: false });

    await app.close();
  });
});
