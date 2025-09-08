import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticator } from 'otplib';
import buildServer from '../src/server.js';
import { encrypt, decrypt } from '../src/util/crypto.js';
import { env } from '../src/util/env.js';
import { insertUser, getUserEmailEnc, setUserEnabled } from './repos/users.js';
import { setUserTotpSecret } from '../src/repos/users.js';

function stubFetch(payload: { sub: string; email: string }) {
  const orig = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ ...payload, aud: 'test-client' }),
  }) as any;
  return () => {
    global.fetch = orig;
  };
}

test('creates user on first login', async (t) => {
  const restore = stubFetch({ sub: '123', email: 'user@example.com' });
  const app = await buildServer();
  t.after(() => {
    restore();
    return app.close();
  });

  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { 'sec-fetch-site': 'same-origin' },
    payload: { token: 'test-token' },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['set-cookie']);
  const body = res.json() as any;
  assert.equal(body.role, 'user');
  const row = await getUserEmailEnc(body.id);
  assert.ok(row);
  const email = decrypt(row!.email_enc!, env.KEY_PASSWORD);
  assert.equal(email, 'user@example.com');
});

test('requires otp when 2fa enabled', async (t) => {
  const restore = stubFetch({ sub: '2', email: 'user2@example.com' });
  const app = await buildServer();
  t.after(() => {
    restore();
    return app.close();
  });
  const secret = authenticator.generateSecret();
  const id = await insertUser('2', encrypt('user2@example.com', env.KEY_PASSWORD));
  await setUserTotpSecret(id, secret);

  const res1 = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { 'sec-fetch-site': 'same-origin' },
    payload: { token: 't1' },
  });
  assert.equal(res1.statusCode, 401);

  const otp = authenticator.generate(secret);
  const res2 = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { 'sec-fetch-site': 'same-origin' },
    payload: { token: 't1', otp },
  });
  assert.equal(res2.statusCode, 200);
});

test('rejects disabled users', async (t) => {
  const restore = stubFetch({ sub: '3', email: 'u3@example.com' });
  const app = await buildServer();
  t.after(() => {
    restore();
    return app.close();
  });
  const id = await insertUser('3', encrypt('u3@example.com', env.KEY_PASSWORD));
  await setUserEnabled(id, false);

  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { 'sec-fetch-site': 'same-origin' },
    payload: { token: 't' },
  });
  assert.equal(res.statusCode, 403);
});

test('requires csrf token for cross-site requests', async (t) => {
  const restore = stubFetch({ sub: 'csrf', email: 'csrf@example.com' });
  const app = await buildServer();
  t.after(() => {
    restore();
    return app.close();
  });

  const res1 = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { 'sec-fetch-site': 'cross-site' },
    payload: { token: 't' },
  });
  assert.equal(res1.statusCode, 403);

  const tokenRes = await app.inject({ method: 'GET', url: '/api/login/csrf' });
  const csrfToken = (tokenRes.json() as any).csrfToken;
  const cookieHeader = (tokenRes.headers['set-cookie'] as string).split(';')[0];

  const res2 = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: {
      'sec-fetch-site': 'cross-site',
      'x-csrf-token': csrfToken,
      cookie: cookieHeader,
    },
    payload: { token: 't' },
  });
  assert.equal(res2.statusCode, 200);
});

test('returns session info for authenticated request', async (t) => {
  const restore = stubFetch({ sub: 'sess', email: 'sess@example.com' });
  const app = await buildServer();
  t.after(() => {
    restore();
    return app.close();
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { 'sec-fetch-site': 'same-origin' },
    payload: { token: 't' },
  });
  const cookie = loginRes.headers['set-cookie'] as string;

  const res = await app.inject({
    method: 'GET',
    url: '/api/login/session',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as any;
  assert.equal(body.email, 'sess@example.com');
});

test('rejects requests without session', async (t) => {
  const app = await buildServer();
  t.after(() => app.close());
  const res = await app.inject({ method: 'GET', url: '/api/login/session' });
  assert.equal(res.statusCode, 403);
});

// db closed in test setup
