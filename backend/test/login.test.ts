import { describe, it, expect, vi, afterAll } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
const { OAuth2Client } = await import('google-auth-library');
const { authenticator } = await import('otplib');
const { default: buildServer } = await import('../src/server.js');

describe('login route', () => {
  it('creates user on first login', async () => {
    migrate();
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
    migrate();
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

  afterAll(() => {
    db.close();
  });
});
