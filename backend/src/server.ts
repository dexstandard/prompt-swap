import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import helmet from '@fastify/helmet';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RATE_LIMITS } from './rate-limit.js';
import { errorResponse } from './util/errorMessages.js';
import { fetchOutputIp } from './util/output-ip.js';
import { migrate } from './db/index.js';

export default async function buildServer(
  routesDir: string = path.join(new URL('.', import.meta.url).pathname, 'routes'),
): Promise<FastifyInstance> {
  await migrate();
  const app = Fastify({ logger: true });

  await app.register(cookie);
  await app.register(csrf, {
    getToken: (req) => req.headers['x-csrf-token'] as string,
    cookieOpts: { sameSite: 'strict', path: '/', secure: true },
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        imgSrc: ["'self'", 'data:', 'https://accounts.google.com'],
        connectSrc: ["'self'", 'https://api.binance.com', 'https://accounts.google.com'],
        fontSrc: ["'self'", 'data:'],
        frameSrc: ['https://accounts.google.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
  });

  await app.register(rateLimit, {
    global: false,
    ...RATE_LIMITS.LAX,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      ...errorResponse(`Too many requests, please try again in ${context.after}.`),
    }),
  });

  await fetchOutputIp();

  for (const file of fs.readdirSync(routesDir)) {
    if (file.endsWith('.js') || (file.endsWith('.ts') && !file.endsWith('.d.ts'))) {
      const route = await import(pathToFileURL(path.join(routesDir, file)).href);
      app.register(route.default, { prefix: '/api' });
    }
  }

  app.log.info('Server initialized');
  return app;
}
