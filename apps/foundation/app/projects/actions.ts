// app/projects/actions.ts
'use server';
import { requireAdmin, AuthorizationError } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function deleteProject(projectId: string) {
    try {
        // 1. Authorization: Admin-only action
        await requireAdmin();

        // 2. Business Logic - Soft delete
        await prisma.project.update({
            where: { id: projectId },
            data: { deletedAt: new Date() }
        });

        revalidatePath('/projects');
        return { success: true };
    } catch (error) {
        if (error instanceof AuthorizationError) {
            return { success: false, error: error.message };
        }
        // For unexpected errors, don't leak details to the client.
        console.error(error);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}