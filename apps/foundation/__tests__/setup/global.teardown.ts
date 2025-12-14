// __tests__/setup/global.teardown.ts
import { prisma } from '../../lib/prisma';

/**
 * This function runs once after all Vitest integration tests have completed.
 * It ensures the Prisma client is properly disconnected, preventing open handles
 * from keeping the test process running.
 */
export async function teardown() {
  await prisma.$disconnect();
  console.log('\n✅ Prisma client disconnected.');
}
