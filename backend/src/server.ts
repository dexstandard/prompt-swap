import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RATE_LIMITS } from './rate-limit.js';
import { errorResponse } from './util/errorMessages.js';

export default async function buildServer(
  routesDir: string = path.join(process.cwd(), 'src/routes'),
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(rateLimit, {
    global: false,
    ...RATE_LIMITS.LAX,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      ...errorResponse(`Too many requests, please try again in ${context.after}.`),
    }),
  });

  for (const file of fs.readdirSync(routesDir)) {
    if (file.endsWith('.js') || (file.endsWith('.ts') && !file.endsWith('.d.ts'))) {
      const route = await import(pathToFileURL(path.join(routesDir, file)).href);
      app.register(route.default, { prefix: '/api' });
    }
  }

  app.log.info('Server initialized');
  return app;
}
