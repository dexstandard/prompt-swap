import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RATE_LIMITS } from '../src/rate-limit.js';

interface Endpoint {
  name: string;
  method: 'GET' | 'POST';
  url: string;
  limit: number;
  payload?: Record<string, unknown>;
  setup?: () => Promise<void> | void;
}

const endpoints: Endpoint[] = [
  { name: 'health', method: 'GET', url: '/api/health', limit: RATE_LIMITS.LAX.max },
  {
    name: 'login',
    method: 'POST',
    url: '/api/login',
    payload: { token: 'test-token' },
    limit: RATE_LIMITS.VERY_TIGHT.max,
    setup: async () => {
      const { OAuth2Client } = await import('google-auth-library');
      vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({ sub: 'user1', email: 'user@example.com' }),
      } as any);
    },
  },
  { name: 'agents', method: 'GET', url: '/api/agents/paginated', limit: RATE_LIMITS.RELAXED.max },
  { name: 'api-keys', method: 'GET', url: '/api/users/u1/ai-key', limit: RATE_LIMITS.MODERATE.max },
  {
    name: 'binance-balance',
    method: 'GET',
    url: '/api/users/u1/binance-balance',
    limit: RATE_LIMITS.MODERATE.max,
  },
  { name: 'models', method: 'GET', url: '/api/users/u1/models', limit: RATE_LIMITS.MODERATE.max },
  { name: 'twofa-status', method: 'GET', url: '/api/2fa/status', limit: RATE_LIMITS.MODERATE.max },
  { name: 'twofa-setup', method: 'GET', url: '/api/2fa/setup', limit: RATE_LIMITS.TIGHT.max },
];

describe('rate limiting', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = ':memory:';
    process.env.KEY_PASSWORD = 'test-pass';
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  for (const ep of endpoints) {
    it(`returns 429 after exceeding limit on ${ep.name}`, async () => {
      const { db, migrate } = await import('../src/db/index.js');
      migrate();
      if (ep.setup) await ep.setup();
      const { default: buildServer } = await import('../src/server.js');
      const app = await buildServer();

      const opts: any = { method: ep.method, url: ep.url };
      if (ep.payload) opts.payload = ep.payload;

      for (let i = 0; i < ep.limit; i++) {
        await app.inject(opts);
      }
      const res = await app.inject(opts);

      expect(res.statusCode).toBe(429);
      const body = res.json();
      expect(body).toMatchObject({ error: 'Too Many Requests' });
      expect(body.message).toContain('Too many requests');

      await app.close();
      db.close();
    });
  }
});

