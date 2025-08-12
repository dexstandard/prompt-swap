import { describe, it, expect, vi } from 'vitest';

process.env.DATABASE_URL = ':memory:';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

const { db, migrate } = await import('../src/db/index.js');
const { OAuth2Client } = await import('google-auth-library');
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
      url: '/login',
      payload: { token: 'test-token' },
    });
    expect(res.statusCode).toBe(200);
    const row = db
      .prepare('SELECT id FROM users WHERE id = ?')
      .get('user123') as { id: string } | undefined;
    expect(row).toBeTruthy();
    await app.close();
    db.close();
  });
});
