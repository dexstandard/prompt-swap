import type { FastifyInstance } from 'fastify';

export default async function healthRoute(app: FastifyInstance) {
  app.get('/health', async () => {
    return { ok: true, ts: Date.now() };
  });
}
