import type { FastifyInstance } from 'fastify';
import { RATE_LIMITS } from '../rate-limit.js';

export default async function healthRoute(app: FastifyInstance) {
  app.get(
    '/health',
    {
      config: { rateLimit: RATE_LIMITS.LAX },
    },
    async () => {
      return { ok: true, ts: Date.now() };
    }
  );
}
