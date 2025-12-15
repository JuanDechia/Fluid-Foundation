// app/projects/actions.ts
'use server';
import { requireAdmin, AuthorizationError } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function deleteProject(projectId: string, formData?: FormData) {
    try {
        // 1. Authorization: Admin-only action
        await requireAdmin();

        // 2. Business Logic - Soft delete
        await prisma.project.update({
            where: { id: projectId },
            data: { deletedAt: new Date() }
        });

        revalidatePath('/projects');
        revalidatePath('/projects');
    } catch (error) {
        if (error instanceof AuthorizationError) {
            // In a simple form action without useFormState, throwing is the only way to notify
            // But for now we just log to avoid crashing the page if it's admin check
            console.error('Authorization failed:', error.message);
            return;
        }
        console.error(error);
    }
}