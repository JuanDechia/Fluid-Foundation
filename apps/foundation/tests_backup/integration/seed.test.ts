
import { describe, it, expect } from 'vitest';
import { prisma } from '../../lib/prisma';
import type { Permission } from '@prisma/client';

describe('Prisma Seed Script', () => {
  it('should seed the database with default roles and permissions', async () => {
    const adminRole = await prisma.role.findUnique({
      where: { name: 'Admin' },
      include: { permissions: true },
    });

    const memberRole = await prisma.role.findUnique({
      where: { name: 'Member' },
      include: { permissions: true },
    });

    const viewerRole = await prisma.role.findUnique({
      where: { name: 'Viewer' },
      include: { permissions: true },
    });

    expect(adminRole).toBeDefined();
    expect(memberRole).toBeDefined();
    expect(viewerRole).toBeDefined();

    const adminPermissions = adminRole?.permissions.map((p: { permission: Permission }) => p.permission);
    const memberPermissions = memberRole?.permissions.map((p: { permission: Permission }) => p.permission);
    const viewerPermissions = viewerRole?.permissions.map((p: { permission: Permission }) => p.permission);

    expect(adminPermissions).toContain('PROJECT_CREATE');
    expect(adminPermissions).toContain('PROJECT_READ');
    expect(adminPermissions).toContain('PROJECT_UPDATE');
    expect(adminPermissions).toContain('PROJECT_DELETE');
    expect(adminPermissions).toContain('TEAM_READ');
    expect(adminPermissions).toContain('TEAM_UPDATE_ROLE');
    expect(adminPermissions).toContain('TEAM_REMOVE_MEMBER');
    expect(adminPermissions).toContain('BILLING_MANAGE');

    expect(memberPermissions).toContain('PROJECT_CREATE');
    expect(memberPermissions).toContain('PROJECT_READ');
    expect(memberPermissions).toContain('PROJECT_UPDATE');
    expect(memberPermissions).toContain('TEAM_READ');
    expect(memberPermissions).not.toContain('PROJECT_DELETE');

    expect(viewerPermissions).toContain('PROJECT_READ');
    expect(viewerPermissions).toContain('TEAM_READ');
    expect(viewerPermissions).not.toContain('PROJECT_CREATE');
  });
});
