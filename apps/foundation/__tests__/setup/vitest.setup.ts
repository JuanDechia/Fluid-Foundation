// __tests__/setup/vitest.setup.ts
import { vi, beforeEach } from 'vitest';
// Reuse the shared Prisma client from lib/prisma so the same generated client is used
// across the app and the tests. This prevents race conditions where tests instantiate
// a PrismaClient before the test database schema/client is generated in global.setup.
import { prisma } from '../../lib/prisma';


// --- MOCKS ---

// Mock Clerk's auth() to control user context in tests.
// This mock is more complete and type-safe, preventing potential runtime errors.
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({
    userId: null,
    orgId: null,
    actor: null,
    session: null,
    organization: null,
    user: null,
  })),
  clerkClient: {
    users: {
      getToken: vi.fn(),
    },
  },
}));

// Mock React's `cache` to prevent memoization across tests, which can cause flaky results.
vi.mock('react', async (importOriginal) => {
    const mod = await importOriginal<typeof import('react')>();
    return { ...mod, cache: (fn: any) => fn };
});

// Mock the 'server-only' package to prevent errors in a non-server test environment.
vi.mock('server-only', () => ({}));

// --- DATABASE CLEANING ---

/**
 * Truncates all tables in the database to ensure perfect isolation between tests.
 */
async function cleanDatabase() {
    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>
      `SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    // Ensure we annotate types to avoid implicit any errors under strict TS settings.
    const tables = (tablenames as Array<{ tablename: string }>)
        .map(({ tablename }: { tablename: string }) => tablename)
        .filter((name: string) => name !== '_prisma_migrations')
        .map((name: string) => `"public"."${name}"`);

    if (tables.length > 0) {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`);
    }
}

// Runs before each test for a clean slate.
beforeEach(async () => {
    await cleanDatabase();
});