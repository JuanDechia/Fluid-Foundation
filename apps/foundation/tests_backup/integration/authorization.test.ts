
import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import {
  getCurrentUserPermissions,
  authorize,
  withAuthorization,
  AuthorizationError,
} from '../../lib/authorization';
import { prisma } from '../../lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { Permission } from '@prisma/client';
import { NextRequest } from 'next/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

describe('Authorization Logic', () => {
  it('getCurrentUserPermissions returns no permissions for unauthenticated users', async () => {
    (auth as Mock).mockReturnValue({});
    const { permissions, can } = await getCurrentUserPermissions();
    expect(permissions.size).toBe(0);
    expect(can(Permission.PROJECT_CREATE)).toBe(false);
  });

  it('getCurrentUserPermissions returns correct permissions for authenticated users', async () => {
    const role = await prisma.role.create({
      data: {
        name: 'Test Role',
        permissions: {
          create: [{ permission: Permission.PROJECT_CREATE }],
        },
      },
    });
    const user = await prisma.user.create({ data: { id: 'user_123', email: 'test@example.com' } });
    await prisma.organizationMembership.create({
      data: {
        organizationId: 'org_123',
        userId: user.id,
        roleId: role.id,
      },
    });
    (auth as Mock).mockReturnValue({ userId: 'user_123', orgId: 'org_123' });

    const { permissions, can } = await getCurrentUserPermissions();

    expect(permissions.size).toBe(1);
    expect(can(Permission.PROJECT_CREATE)).toBe(true);
    expect(can(Permission.PROJECT_DELETE)).toBe(false);
  });

  it('authorize throws AuthorizationError for user without permission', async () => {
    (auth as Mock).mockReturnValue({ userId: 'user_123', orgId: 'org_123' });
    await expect(authorize(Permission.PROJECT_DELETE)).rejects.toThrow(AuthorizationError);
  });

  it('authorize does not throw for user with permission', async () => {
    const role = await prisma.role.create({
      data: {
        name: 'Test Role 2',
        permissions: {
          create: [{ permission: Permission.PROJECT_DELETE }],
        },
      },
    });
    const user = await prisma.user.create({ data: { id: 'user_456', email: 'test2@example.com' } });
    await prisma.organizationMembership.create({
      data: {
        organizationId: 'org_456',
        userId: user.id,
        roleId: role.id,
      },
    });
    (auth as Mock).mockReturnValue({ userId: 'user_456', orgId: 'org_456' });

    await expect(authorize(Permission.PROJECT_DELETE)).resolves.toBeUndefined();
  });

  it('withAuthorization returns 403 for user without permission', async () => {
    (auth as Mock).mockReturnValue({ userId: 'user_123', orgId: 'org_123' });
    const handler = vi.fn(async (_req: NextRequest, _params: unknown) => new Response('NOOP'));
    const authorizedHandler = withAuthorization(Permission.PROJECT_DELETE, handler);
    const req = new NextRequest('http://localhost');
    const res = await authorizedHandler(req, {});

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('withAuthorization calls handler for user with permission', async () => {
    const role = await prisma.role.create({
      data: {
        name: 'Test Role 3',
        permissions: {
          create: [{ permission: Permission.PROJECT_READ }],
        },
      },
    });
    const user = await prisma.user.create({ data: { id: 'user_789', email: 'test3@example.com' } });
    await prisma.organizationMembership.create({
      data: {
        organizationId: 'org_789',
        userId: user.id,
        roleId: role.id,
      },
    });
    (auth as Mock).mockReturnValue({ userId: 'user_789', orgId: 'org_789' });

    const handler = vi.fn(async (_req: NextRequest, _params: unknown) => new Response('Success'));
    const authorizedHandler = withAuthorization(Permission.PROJECT_READ, handler);
    const req = new NextRequest('http://localhost');
    const res = await authorizedHandler(req, {});

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });
});
