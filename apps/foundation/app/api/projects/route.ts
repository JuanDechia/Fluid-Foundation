// app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { Permission } from '@prisma/client';
import { withAuthorization } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
async function getProjectsHandler() {
// RLS is automatically applied via the withAuthorization -> withTenantContext wrapper.
const projects = await prisma.project.findMany();
return NextResponse.json(projects);
}
// Wrap the handler to protect the route. Only users with PROJECT_READ can access this.
export const GET = withAuthorization(Permission.PROJECT_READ, getProjectsHandler);