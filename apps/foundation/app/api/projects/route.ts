// app/api/projects/route.ts
import { NextResponse } from 'next/server';

import { withAuthorization } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
async function getProjectsHandler() {
    // RLS is automatically applied via the withAuthorization -> withTenantContext wrapper.
    const projects = await prisma.project.findMany();
    return NextResponse.json(projects);
}
// Wrap the handler to protect the route. Only users with organization access can access this.
export const GET = withAuthorization(getProjectsHandler);