import { describe, it, expect, vi, afterEach } from 'vitest';
import buildServer from '../src/server.js';

describe('ip route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns server ip', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => '1.2.3.4' })) as any);
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/api/ip' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ip: '1.2.3.4' });
    await app.close();
  });
});
