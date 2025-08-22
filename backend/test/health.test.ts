import { describe, it, expect } from 'vitest';
import buildServer from '../src/server.js';

describe('health route', () => {
  it('returns ok', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });
});
