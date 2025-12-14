// __tests__/setup/global.setup.ts
import { execa } from 'execa';
import { loadEnvConfig } from '@next/env';

// Ensures process.env is populated from .env.test and .env.test.local
loadEnvConfig(process.cwd());

/**
 * This function runs once before all Vitest integration tests.
 * It resets the test database to a clean state, ensuring a consistent
 * starting point for the entire test suite.
 */
export async function setup() {
  console.log('\n🚀 Preparing integration test database...');
  try {
    // Assumes the DB container is already running via `npm run test:start-env`.
    // Ensure the schema exists in the test database. If no migration history exists,
    // `prisma db push` will create the tables from the schema.prisma file.
    await execa('npx', ['prisma', 'db', 'push'], { stdio: 'inherit' });
    // Generate the Prisma Client after pushing schema so the client matches the DB schema.
    await execa('npx', ['prisma', 'generate'], { stdio: 'inherit' });
    console.log('✅ Integration test database is ready.');
  } catch (error) {
    console.error('❌ Failed to reset the database. Is the Docker container running?');
    console.error('Hint: Run `npm run test:start-env` first.');
    console.error(error);
    process.exit(1); // Exit with a failure code to stop the test run.
  }

  // Vitest v1+ no longer supports `globalTeardown` in config.
  // Instead, return a teardown function from globalSetup.
  const { teardown } = await import('./global.teardown');
  return async () => {
    await teardown();
  };
}
