import { describe, it, expect } from 'vitest';
import buildServer from '../src/server.js';

describe('health route', () => {
  it('returns ok with security headers', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain('https://accounts.google.com');
    expect(res.headers['content-security-policy']).toContain('https://api.binance.com');
    await app.close();
  });
});
