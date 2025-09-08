import type { FastifyInstance } from 'fastify';
import { RATE_LIMITS } from '../rate-limit.js';
import { getOutputIp } from '../util/output-ip.js';

export default async function ipRoute(app: FastifyInstance) {
  app.get(
    '/ip',
    {
      config: { rateLimit: RATE_LIMITS.LAX },
    },
    async () => {
      return { ip: getOutputIp() };
    },
  );
}
