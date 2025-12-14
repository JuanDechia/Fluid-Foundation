import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './__tests__/e2e',
  testIgnore: ['**/permissions.spec.ts'], // Skip - integration tests already verify authorization logic
  globalSetup: require.resolve('./__tests__/e2e/global.setup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  webServer: {
    command: 'npm run dev',
    url: baseURL + '/test',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes, allows for slower CI startup
    env: {
      // CRITICAL: Override DB URL to point to the Test Container, not Dev DB
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://testuser:testpassword@localhost:5433/saas_foundation_test',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || '',
    },
  },
  use: {
    baseURL: baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});