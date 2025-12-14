import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/clerk/route';
import { prisma } from '@/lib/prisma';

// Mock Svix to bypass signature verification logic during tests
vi.mock('svix', () => ({
    Webhook: vi.fn().mockImplementation(() => ({
        verify: vi.fn((payload) => JSON.parse(payload)),
    })),
}));

// Mock Headers
vi.mock('next/headers', () => ({
    headers: () => ({
        get: (key: string) => 'mock_value',
    }),
}));

describe('Webhook Integration', () => {
    // Reset state to prevent test pollution
    beforeEach(async () => {
        await prisma.project.deleteMany();
        await prisma.organization.deleteMany();
        await prisma.user.deleteMany();
    });

    it('should create or update organization when organization.created is received', async () => {
        const payload = {
            type: 'organization.created',
            data: {
                id: 'org_webhook_test',
                name: 'Webhook Test Org',
                slug: 'webhook-test-org'
            }
        };

        const req = new Request('http://localhost/api/webhooks', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const org = await prisma.organization.findUnique({ where: { id: 'org_webhook_test' } });
        expect(org).toBeTruthy();
        expect(org?.name).toBe('Webhook Test Org');
        expect(org?.slug).toBe('webhook-test-org');
    });

    it('should soft delete organization when organization.deleted is received', async () => {
        // Setup initial state
        await prisma.organization.create({
            data: { id: 'org_to_delete', name: 'To Delete', slug: 'to-delete' }
        });

        const payload = {
            type: 'organization.deleted',
            data: {
                id: 'org_to_delete'
            }
        };

        const req = new Request('http://localhost/api/webhooks', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const org = await prisma.organization.findUnique({ where: { id: 'org_to_delete' } });
        expect(org?.deletedAt).toBeTruthy();
    });

    it('should create or update user when user.created is received', async () => {
        const payload = {
            type: 'user.created',
            data: {
                id: 'user_webhook_test',
                email_addresses: [{ email_address: 'webhook@test.com' }]
            }
        };

        const req = new Request('http://localhost/api/webhooks', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        const user = await prisma.user.findUnique({ where: { id: 'user_webhook_test' } });
        expect(user).toBeTruthy();
        expect(user?.email).toBe('webhook@test.com');
    });
});
