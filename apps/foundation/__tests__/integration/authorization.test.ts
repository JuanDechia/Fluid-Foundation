// __tests__/integration/authorization.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { main as seedDatabase } from '@/prisma/seed';

// Server action for testing role-based access
async function deleteProject(projectId: string) {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    throw new Error('You must be logged in to an organization to delete a project.');
  }

  // Admin-only action
  if (orgRole !== 'org:admin') {
    throw new Error('This action requires organization admin privileges.');
  }

  return { success: true, projectId };
}

describe('Role-Based Authorization Logic', () => {
  let testOrg: any;
  let adminUser: any;
  let memberUser: any;

  beforeEach(async () => {
    // Seed test data
    await seedDatabase();

    // Get the seeded org and users
    testOrg = await prisma.organization.findUnique({ where: { id: 'org_e2e_test' } });
    adminUser = await prisma.user.findFirst({ where: { email: 'admin@e2e.test' } });
    memberUser = await prisma.user.findFirst({ where: { email: 'member@e2e.test' } });
  });

  it('should allow an admin to perform admin-only actions', async () => {
    // Mock auth to return admin role
    vi.mocked(auth).mockResolvedValue({
      userId: adminUser.id,
      orgId: testOrg.id,
      orgRole: 'org:admin', // Admin role
      sessionClaims: null,
      sessionId: null,
      actor: null,
      orgSlug: null,
      organization: null,
      user: null,
      session: null,
      // @ts-ignore
      protect: () => { }
    });

    await expect(deleteProject('project_123')).resolves.toEqual({ success: true, projectId: 'project_123' });
  });

  it('should prevent a member from performing admin-only actions', async () => {
    // Mock auth to return member role
    vi.mocked(auth).mockResolvedValue({
      userId: memberUser.id,
      orgId: testOrg.id,
      orgRole: 'org:member', // Member role
      sessionClaims: null,
      sessionId: null,
      actor: null,
      orgSlug: null,
      organization: null,
      user: null,
      session: null,
      // @ts-ignore
      protect: () => { }
    });

    await expect(deleteProject('project_123')).rejects.toThrow('This action requires organization admin privileges');
  });

  it('should prevent an unauthenticated user from performing actions', async () => {
    // Mock auth to return no user/org
    vi.mocked(auth).mockResolvedValue({
      userId: null,
      orgId: null,
      orgRole: null,
      sessionClaims: null,
      sessionId: null,
      actor: null,
      orgSlug: null,
      organization: null,
      user: null,
      session: null,
      // @ts-ignore
      protect: () => { }
    });

    await expect(deleteProject('project_123')).rejects.toThrow('You must be logged in to an organization');
  });
});
