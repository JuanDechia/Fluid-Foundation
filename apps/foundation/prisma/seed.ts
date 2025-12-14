import { prisma } from '../lib/prisma';

/**
 * Simplified seeder function for test data.
 * 
 * Seeds E2E test organizations, users, and projects.
 */
export async function main() {
  console.log('Seeding E2E test data...');

  const orgId = 'org_e2e_test';
  const adminUserId = 'user_e2e_admin';
  const memberUserId = 'user_e2e_member';

  try {
    // Create Organization with slug
    await prisma.organization.upsert({
      where: { id: orgId },
      update: {},
      create: {
        id: orgId,
        name: 'E2E Test Corp',
        slug: 'e2e-test-corp'
      }
    });

    // Create Users
    await prisma.user.upsert({
      where: { id: adminUserId },
      update: {},
      create: { id: adminUserId, email: 'admin@e2e.test' }
    });

    await prisma.user.upsert({
      where: { id: memberUserId },
      update: {},
      create: { id: memberUserId, email: 'member@e2e.test' }
    });

    console.log('E2E test users and organization seeded.');

    // Seed test projects
    await prisma.project.upsert({
      where: { id: 'project_e2e_test_1' },
      update: {},
      create: { id: 'project_e2e_test_1', name: 'Test Project 1', organizationId: orgId }
    });

    await prisma.project.upsert({
      where: { id: 'project_e2e_test_2' },
      update: {},
      create: { id: 'project_e2e_test_2', name: 'Test Project 2', organizationId: orgId }
    });

    console.log('E2E test projects seeded.');

  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run only outside of testing to preserve test-runner stability.
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}