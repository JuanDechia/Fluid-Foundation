// __tests__/integration/seed.test.ts
import { describe, it, expect } from 'vitest';
import { main as seedDatabase } from '../../prisma/seed';
import { prisma } from '@/lib/prisma';

describe('Database Seeding Script', () => {
  it('should create E2E test data (org, users, projects)', async () => {
    await seedDatabase();

    // Check organization was created
    const org = await prisma.organization.findUnique({ where: { id: 'org_e2e_test' } });
    expect(org).toBeTruthy();
    expect(org?.name).toBe('E2E Test Corp');
    expect(org?.slug).toBe('e2e-test-corp');

    // Check users were created
    const users = await prisma.user.findMany({ where: { id: { in: ['user_e2e_admin', 'user_e2e_member'] } } });
    expect(users.length).toBe(2);

    // Check projects were created
    const projects = await prisma.project.findMany({ where: { organizationId: 'org_e2e_test' } });
    expect(projects.length).toBeGreaterThanOrEqual(2);
  });

  it('should be idempotent and not duplicate data on second run', async () => {
    await seedDatabase();
    const projectCountAfterFirstRun = await prisma.project.count({ where: { organizationId: 'org_e2e_test' } });

    await seedDatabase();
    const projectCountAfterSecondRun = await prisma.project.count({ where: { organizationId: 'org_e2e_test' } });

    expect(projectCountAfterSecondRun).toBe(projectCountAfterFirstRun);
  });
});
