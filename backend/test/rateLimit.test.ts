import { describe, it, expect, afterEach, vi } from 'vitest';
import { RATE_LIMITS } from '../src/rate-limit.js';
import buildServer from '../src/server.js';

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
        getPayload: () => ({ sub: '1', email: 'user@example.com' }),
      } as any);
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

describe('rate limiting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const ep of endpoints) {
    it(`returns 429 after exceeding limit on ${ep.name}`, async () => {
      if (ep.setup) await ep.setup();
      const app = await buildServer();

      const opts: any = { method: ep.method, url: ep.url };
      if (ep.payload) opts.payload = ep.payload;

      for (let i = 0; i < ep.limit; i++) {
        await app.inject(opts);
      }
      const res = await app.inject(opts);

      expect(res.statusCode).toBe(429);
      const body = res.json();
      expect(body).toMatchObject({
        error: expect.stringMatching(/too many requests/i),
      });

      await app.close();
    });
  }
});

