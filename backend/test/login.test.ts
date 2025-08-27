import { describe, it, expect, vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { authenticator } from 'otplib';
import buildServer from '../src/server.js';
import { encrypt, decrypt } from '../src/util/crypto.js';
import { env } from '../src/util/env.js';
import { insertUser, getUserEmailEnc, setUserEnabled } from './repos/users.js';
import { setUserTotpSecret } from '../src/repos/users.js';

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
    const body = res.json() as any;
    expect(body.role).toBe('user');
    const row = getUserEmailEnc('user123');
    expect(row).toBeTruthy();
    const email = decrypt(row!.email_enc!, env.KEY_PASSWORD);
    expect(email).toBe('user@example.com');
    await app.close();
  });

  it('requires otp when 2fa enabled', async () => {
    const app = await buildServer();
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({ sub: 'user2', email: 'user2@example.com' }),
    } as any);
    const secret = authenticator.generateSecret();
    insertUser('user2', encrypt('user2@example.com', env.KEY_PASSWORD));
    setUserTotpSecret('user2', secret);

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

  it('rejects disabled users', async () => {
    const app = await buildServer();
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({ sub: 'user3', email: 'u3@example.com' }),
    } as any);
    insertUser('user3', encrypt('u3@example.com', env.KEY_PASSWORD));
    setUserEnabled('user3', false);

    const res = await app.inject({
      method: 'POST',
      url: '/api/login',
      payload: { token: 't' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  // db closed in test setup
});
