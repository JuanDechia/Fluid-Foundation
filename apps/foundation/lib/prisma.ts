import { PrismaClient } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';

// 1. Raw Client: UNSAFE. Never export this to the UI apps.
const prismaUnsafe = new PrismaClient();

// Models that do not belong to a specific tenant
const GLOBAL_MODELS = ['User', 'AuditLog'];

/**
 * THE SAFE CLIENT FACTORY
 * 
 * Usage: const db = await getTenantDb();
 * 
 * This factory creates a database client that:
 * 
 * - Automatically filters data by the logged-in Organization.
 * 
 * - Automatically injects the Organization ID on creates.
 * 
 * - Handles Soft Deletes (filters out deleted items).
 */
export const getTenantDb = async () => {
  // FIX: auth() is async in newer Clerk versions
  const { orgId } = await auth();

  return prismaUnsafe.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // 1. Bypass for Global Models
          if (GLOBAL_MODELS.includes(model)) return query(args);

          // 2. Handle Onboarding (Creating an Org when you don't have one yet)
          if (model === 'Organization' && operation === 'create') {
            return query(args);
          }

          // 3. Security Gate: Require OrgId for everything else
          if (!orgId) {
            throw new Error(`SECURITY: Attempted to access ${model} without an Organization Context.`);
          }

          const safeArgs = (args as any) || {};

          // --- WRITE OPERATIONS: Inject Org ID ---
          if (operation === 'create' || operation === 'createMany' || operation === 'upsert') {
            // FIX: Handle createMany (Array) vs create (Object)
            if (operation === 'createMany' && Array.isArray(safeArgs.data)) {
              safeArgs.data = safeArgs.data.map((item: any) => ({ ...item, organizationId: orgId }));
            } else if (safeArgs.data) {
              // Standard create
              safeArgs.data = { ...safeArgs.data, organizationId: orgId };
            }

            // Handle upsert 'create' branch
            if (operation === 'upsert' && safeArgs.create) {
              safeArgs.create = { ...safeArgs.create, organizationId: orgId };
            }
          }

          // --- READ/DELETE OPERATIONS: Filter by Org ID + Soft Delete ---

          // Standardize Filter
          if (!safeArgs.where) safeArgs.where = {};

          // Inject Multi-tenancy Filter
          safeArgs.where.organizationId = orgId;

          // Inject Soft Delete Filter (Exclude deleted items)
          safeArgs.where.deletedAt = null;

          // FIX: Handle findUnique Limitation
          // findUnique requires a unique constraint. Adding 'organizationId' breaks that.
          // We swap to 'findFirst' so we can apply the security filters.
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            return (prismaUnsafe as any)[model].findFirst(safeArgs);
          }

          return query(safeArgs);
        },
      },
    },
  });
};

// Export the unsafe client for webhooks and admin scripts
export const prisma = prismaUnsafe;