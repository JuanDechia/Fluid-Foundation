
import { describe, it, expect, vi } from 'vitest';
import { POST } from '../../app/api/webhooks/clerk/route';
import { prisma } from '../../lib/prisma';
import { Webhook } from 'svix';

vi.mock('svix', () => {
  const Webhook = vi.fn(() => ({
    verify: vi.fn(),
  }));
  return { Webhook };
});

describe('Clerk Webhook Handler', () => {
  it('should handle user.created event', async () => {
    const mockRequest = {
      headers: new Headers({
        'svix-id': 'mock-svix-id',
        'svix-timestamp': 'mock-svix-timestamp',
        'svix-signature': 'mock-svix-signature',
      }),
      json: async () => ({
        type: 'user.created',
        data: {
          id: 'user_123',
          email_addresses: [{ email_address: 'test@example.com' }],
        },
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: 'user_123' } });
    expect(user).toBeDefined();
    expect(user?.email).toBe('test@example.com');
  });

  it('should handle user.updated event', async () => {
    await prisma.user.create({ data: { id: 'user_123', email: 'old@example.com' } });

    const mockRequest = {
      headers: new Headers({
        'svix-id': 'mock-svix-id',
        'svix-timestamp': 'mock-svix-timestamp',
        'svix-signature': 'mock-svix-signature',
      }),
      json: async () => ({
        type: 'user.updated',
        data: {
          id: 'user_123',
          email_addresses: [{ email_address: 'new@example.com' }],
        },
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: 'user_123' } });
    expect(user?.email).toBe('new@example.com');
  });

  it('should handle user.deleted event', async () => {
    await prisma.user.create({ data: { id: 'user_123', email: 'test@example.com' } });

    const mockRequest = {
      headers: new Headers({
        'svix-id': 'mock-svix-id',
        'svix-timestamp': 'mock-svix-timestamp',
        'svix-signature': 'mock-svix-signature',
      }),
      json: async () => ({
        type: 'user.deleted',
        data: {
          id: 'user_123',
        },
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: 'user_123' } });
    expect(user).toBeNull();
  });

  it('should handle organizationMembership.created event', async () => {
    const role = await prisma.role.create({ data: { name: 'Admin' } });
    await prisma.user.create({ data: { id: 'user_123', email: 'test@example.com' } });

    const mockRequest = {
      headers: new Headers({
        'svix-id': 'mock-svix-id',
        'svix-timestamp': 'mock-svix-timestamp',
        'svix-signature': 'mock-svix-signature',
      }),
      json: async () => ({
        type: 'organizationMembership.created',
        data: {
          organization: { id: 'org_123' },
          public_user_data: { user_id: 'user_123' },
          role: 'admin',
        },
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId: 'org_123', userId: 'user_123' },
    });
    expect(membership).toBeDefined();
    expect(membership?.roleId).toBe(role.id);
  });

  it('should handle organizationMembership.deleted event', async () => {
    const role = await prisma.role.create({ data: { name: 'Admin' } });
    const user = await prisma.user.create({ data: { id: 'user_123', email: 'test@example.com' } });
    await prisma.organizationMembership.create({
      data: {
        organizationId: 'org_123',
        userId: user.id,
        roleId: role.id,
      },
    });

    const mockRequest = {
      headers: new Headers({
        'svix-id': 'mock-svix-id',
        'svix-timestamp': 'mock-svix-timestamp',
        'svix-signature': 'mock-svix-signature',
      }),
      json: async () => ({
        type: 'organizationMembership.deleted',
        data: {
          organization: { id: 'org_123' },
          public_user_data: { user_id: 'user_123' },
        },
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId: 'org_123', userId: 'user_123' },
    });
    expect(membership).toBeNull();
  });
});
