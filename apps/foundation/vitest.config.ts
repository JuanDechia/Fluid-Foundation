// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vitest-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/e2e/**'],
    // Run tests in a single worker to avoid database deadlocks when truncating tables.
    // Vitest v1+ replaced `threads` with `poolOptions.threads.singleThread`.
    poolOptions: { threads: { singleThread: true } },
    // This setup runs ONCE before all integration tests start.
    globalSetup: './__tests__/setup/global.setup.ts',
    // Vitest v1+ no longer supports `globalTeardown` in config.
    // We return a teardown function from globalSetup instead.
    // This setup runs BEFORE EACH individual test file.
    setupFiles: './__tests__/setup/vitest.setup.ts',
    testTimeout: 20000, // 20 seconds
  },
});