import { describe, it, expect } from 'vitest';
import buildServer from '../src/server.js';
import { authenticator } from 'otplib';
import { insertUser } from './repos/users.js';
import { authCookies } from './helpers.js';

describe('2fa routes', () => {
  it('enables and disables 2fa', async () => {
    const userId = await insertUser('1');
    const app = await buildServer();

    const setupRes = await app.inject({
      method: 'GET',
      url: '/api/2fa/setup',
      cookies: authCookies(userId),
    });
    expect(setupRes.statusCode).toBe(200);
    const { secret } = setupRes.json() as { secret: string };

    const token = authenticator.generate(secret);
    const enableRes = await app.inject({
      method: 'POST',
      url: '/api/2fa/enable',
      cookies: authCookies(userId),
      payload: { token, secret },
    });
    expect(enableRes.statusCode).toBe(200);

    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/2fa/status',
      cookies: authCookies(userId),
    });
    expect(statusRes.json()).toEqual({ enabled: true });

    const disableRes = await app.inject({
      method: 'POST',
      url: '/api/2fa/disable',
      cookies: authCookies(userId),
      payload: { token: authenticator.generate(secret) },
    });
    expect(disableRes.statusCode).toBe(200);

    const statusRes2 = await app.inject({
      method: 'GET',
      url: '/api/2fa/status',
      cookies: authCookies(userId),
    });
    expect(statusRes2.json()).toEqual({ enabled: false });

    await app.close();
  });
});
