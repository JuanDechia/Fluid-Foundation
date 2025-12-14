// lib/authorization.ts
import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { cache } from 'react';
import { NextRequest, NextResponse } from 'next/server';

type ApiHandler<T> = (req: NextRequest, params: T) => Promise<Response>;

/** Custom error for authorization failures. */
export class AuthorizationError extends Error {
  constructor(message = 'Forbidden: You must be logged in and belong to an organization.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * A cached function to get the current user's authorization context.
 * 
 * Returns authentication status, org membership, and Clerk organization role.
 * 
 * Uses React's cache to ensure this is queried only ONCE per request.
 */
export const getCurrentUserContext = cache(async (): Promise<{
  userId: string | null;
  orgId: string | null;
  orgRole: string | null;
  isAuthenticated: boolean;
  isMember: boolean;
  isAdmin: boolean;
}> => {
  const { userId, orgId, orgRole } = await auth();

  return {
    userId: userId ?? null,
    orgId: orgId ?? null,
    orgRole: orgRole ?? null,
    isAuthenticated: !!userId,
    isMember: !!(userId && orgId),
    isAdmin: orgRole === 'org:admin'
  };
});

/**
 * Core authorization helper for Server Actions.
 * Throws AuthorizationError if user is not authenticated or not in an org.
 */
export async function authorize() {
  const { isMember } = await getCurrentUserContext();
  if (!isMember) {
    throw new AuthorizationError();
  }
}

/**
 * Require admin role for sensitive operations.
 * Throws AuthorizationError if user is not an org admin.
 */
export async function requireAdmin() {
  const { isAdmin, isMember } = await getCurrentUserContext();

  if (!isMember) {
    throw new AuthorizationError('You must be logged in to an organization.');
  }

  if (!isAdmin) {
    throw new AuthorizationError('This action requires organization admin privileges.');
  }
}

/**
 * Require a specific Clerk organization role.
 */
export async function requireRole(requiredRole: 'org:admin' | 'org:member') {
  const { orgRole, isMember } = await getCurrentUserContext();

  if (!isMember) {
    throw new AuthorizationError('You must be logged in to an organization.');
  }

  if (orgRole !== requiredRole) {
    throw new AuthorizationError(`This action requires the ${requiredRole} role.`);
  }
}

/**
 * Get the current user's organization role (for conditional UI).
 * Returns null if user is not in an organization.
 */
export async function getCurrentRole(): Promise<string | null> {
  const { orgRole } = await getCurrentUserContext();
  return orgRole;
}

/**
 * Higher-Order Function to protect API Routes.
 * Ensures the user is authenticated and belongs to an organization.
 * 
 * @param handler The API route handler to execute if the check passes.
 */
export function withAuthorization<T>(handler: ApiHandler<T>) {
  return async (req: NextRequest, params: T) => {
    try {
      await authorize();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return new NextResponse('Forbidden', { status: 403 });
      }
      // Re-throw other errors
      throw error;
    }
    return handler(req, params);
  };
}

/**
 * Higher-Order Function to protect API Routes with admin requirement.
 */
export function withAdminAuthorization<T>(handler: ApiHandler<T>) {
  return async (req: NextRequest, params: T) => {
    try {
      await requireAdmin();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return new NextResponse('Forbidden', { status: 403 });
      }
      throw error;
    }
    return handler(req, params);
  };
}