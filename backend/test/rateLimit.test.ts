import test from 'node:test';
import assert from 'node:assert/strict';
import { RATE_LIMITS } from '../src/rate-limit.js';
import buildServer from '../src/server.js';

interface Endpoint {
  name: string;
  method: 'GET' | 'POST';
  url: string;
  limit: number;
  payload?: Record<string, unknown>;
  setup?: () => Promise<(() => void) | void> | (() => void) | void;
}

const endpoints: Endpoint[] = [
  { name: 'health', method: 'GET', url: '/api/health', limit: RATE_LIMITS.LAX.max },
  {
    name: 'login',
    method: 'POST',
    url: '/api/login',
    payload: { token: 'test-token' },
    limit: RATE_LIMITS.VERY_TIGHT.max,
    setup: () => {
      const orig = global.fetch;
      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          sub: '1',
          email: 'user@example.com',
          aud: 'test-client',
        }),
      }) as any;
      return () => {
        global.fetch = orig;
      };
    },
  },
  { name: 'agents', method: 'GET', url: '/api/agents/paginated', limit: RATE_LIMITS.RELAXED.max },
  { name: 'api-keys', method: 'GET', url: '/api/users/1/ai-key', limit: RATE_LIMITS.MODERATE.max },
  {
    name: 'binance-balance',
    method: 'GET',
    url: '/api/users/1/binance-balance',
    limit: RATE_LIMITS.MODERATE.max,
  },
  { name: 'models', method: 'GET', url: '/api/users/1/models', limit: RATE_LIMITS.MODERATE.max },
  { name: 'twofa-status', method: 'GET', url: '/api/2fa/status', limit: RATE_LIMITS.MODERATE.max },
  { name: 'twofa-setup', method: 'GET', url: '/api/2fa/setup', limit: RATE_LIMITS.TIGHT.max },
];

for (const ep of endpoints) {
  test(`returns 429 after exceeding limit on ${ep.name}`, async (t) => {
    let cleanup: (() => void) | void;
    if (ep.setup) cleanup = await ep.setup();
    const app = await buildServer();
    t.after(() => {
      cleanup?.();
      return app.close();
    });

    const opts: any = { method: ep.method, url: ep.url };
    if (ep.payload) opts.payload = ep.payload;
    if (ep.name === 'login') {
      opts.headers = { 'sec-fetch-site': 'same-origin' };
    }

    for (let i = 0; i < ep.limit; i++) {
      await app.inject(opts);
    }
    const res = await app.inject(opts);

    assert.equal(res.statusCode, 429);
    const body = res.json() as any;
    assert.ok(body.error.includes('Too many requests'));
  });
}
