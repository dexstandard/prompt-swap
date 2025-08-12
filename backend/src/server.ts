import Fastify, { type FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export default async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const routesDir = path.join(__dirname, 'routes');

  for (const file of fs.readdirSync(routesDir)) {
    if (file.endsWith('.js') || (file.endsWith('.ts') && !file.endsWith('.d.ts'))) {
      const route = await import(pathToFileURL(path.join(routesDir, file)).href);
      app.register(route.default);
    }
  }

  app.log.info('Server initialized');
  return app;
}
