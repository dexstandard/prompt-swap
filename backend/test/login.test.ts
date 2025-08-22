import { describe, it, expect, vi } from 'vitest';
import { db } from '../src/db/index.js';
import { OAuth2Client } from 'google-auth-library';
import { authenticator } from 'otplib';
import buildServer from '../src/server.js';

describe('login route', () => {
  it('creates user on first login', async () => {
    const app = await buildServer();
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({ sub: 'user123', email: 'user@example.com' }),
    } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/api/login',
      payload: { token: 'test-token' },
    });
    expect(res.statusCode).toBe(200);
    const row = db
      .prepare('SELECT id FROM users WHERE id = ?')
      .get('user123') as { id: string } | undefined;
    expect(row).toBeTruthy();
    await app.close();
  });

  it('requires otp when 2fa enabled', async () => {
    const app = await buildServer();
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({ sub: 'user2', email: 'user2@example.com' }),
    } as any);
    const secret = authenticator.generateSecret();
    db.prepare(
      'INSERT INTO users (id, is_auto_enabled, totp_secret, is_totp_enabled) VALUES (?, 0, ?, 1)'
    ).run('user2', secret);

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/login',
      payload: { token: 't1' },
    });
    expect(res1.statusCode).toBe(401);

    const otp = authenticator.generate(secret);
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/login',
      payload: { token: 't1', otp },
    });
    expect(res2.statusCode).toBe(200);
    await app.close();
  });

  // db closed in test setup
});
