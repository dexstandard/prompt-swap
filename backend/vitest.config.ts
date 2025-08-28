import { defineConfig } from 'vitest/config';
process.env.KEY_PASSWORD = 'test-pass';
process.env.GOOGLE_CLIENT_ID = 'test-client';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['frontend/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['test/setup.ts'],
    // Tests share a single PostgreSQL instance; run sequentially to avoid
    // cross-test state leaks.
    fileParallelism: false,
  },
});
