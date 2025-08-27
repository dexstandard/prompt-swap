import { defineConfig } from 'vitest/config';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/promptswap_test';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['frontend/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['test/setup.ts'],
  },
});
