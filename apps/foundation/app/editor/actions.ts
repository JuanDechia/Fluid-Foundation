'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUserContext } from '@/lib/authorization';
import { FluidConversation, FluidMessage, FluidState, Prisma } from '@prisma/client';
import { appendLog } from '@/lib/logger';

export type SerializedConversation = {
    id: string;
    title: string;
    updatedAt: string; // Serialize Date to string for client
}

export type SerializedMessage = {
    id: string;
    role: 'user' | 'model' | 'system';
    content: string;
    timestamp: string;
}

export async function getConversations(): Promise<SerializedConversation[]> {
    const { orgId, userId } = await getCurrentUserContext();
    if (!userId) return [];

    const conditions: Prisma.FluidConversationWhereInput[] = [
        { userId: userId, organizationId: null }
    ];
    if (orgId) {
        conditions.push({ organizationId: orgId });
    }

    const start = performance.now();
    const conversations = await prisma.fluidConversation.findMany({
        where: {
            OR: conditions
        },
        orderBy: { updatedAt: 'desc' },
    });
    appendLog('DB - getConversations', performance.now() - start);

    return conversations.map(c => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
    }));
}

export async function createConversation(title: string): Promise<string> {
    const { orgId, userId } = await getCurrentUserContext();

    // Auth Check: Must have a user ID. Org ID is optional now.
    if (!userId) {
        throw new Error('Unauthorized');
    }

    const conversation = await prisma.fluidConversation.create({
        data: {
            title,
            organizationId: orgId || null, // Allow null for personal
            userId,
        }
    });

    return conversation.id;
}

export async function deleteConversation(id: string) {
    const { orgId, userId } = await getCurrentUserContext();
    if (!userId) throw new Error('Unauthorized');

    const conditions: Prisma.FluidConversationWhereInput[] = [
        { userId: userId, organizationId: null }
    ];
    if (orgId) {
        conditions.push({ organizationId: orgId });
    }

    // Verify ownership: Either Org matches OR (Personal AND User matches)
    const count = await prisma.fluidConversation.count({
        where: {
            id,
            OR: conditions
        }
    });

    if (count === 0) throw new Error('Conversation not found or access denied');

    await prisma.fluidConversation.delete({ where: { id } });
}

export async function getMessages(conversationId: string): Promise<SerializedMessage[]> {
    const { orgId, userId } = await getCurrentUserContext();
    if (!userId) return [];

    const conditions: Prisma.FluidConversationWhereInput[] = [
        { userId: userId, organizationId: null }
    ];
    if (orgId) {
        conditions.push({ organizationId: orgId });
    }

    // Verify access
    const conversation = await prisma.fluidConversation.findFirst({
        where: {
            id: conversationId,
            OR: conditions
        }
    });
    if (!conversation) return [];

    const start = performance.now();
    const messages = await prisma.fluidMessage.findMany({
        where: { conversationId },
        orderBy: { timestamp: 'asc' }
    });
    appendLog('DB - getMessages', performance.now() - start);

    return messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'model' | 'system',
        content: m.content,
        timestamp: m.timestamp.toISOString(),
    }));
}

export async function addMessage(conversationId: string, role: string, content: string) {
    const { orgId, userId } = await getCurrentUserContext();
    if (!userId) throw new Error('Unauthorized');

    const conditions: Prisma.FluidConversationWhereInput[] = [
        { userId: userId, organizationId: null }
    ];
    if (orgId) {
        conditions.push({ organizationId: orgId });
    }

    // Verify access
    const conversation = await prisma.fluidConversation.count({
        where: {
            id: conversationId,
            OR: conditions
        }
    });
    if (conversation === 0) throw new Error('Conversation not found');

    const start = performance.now();
    await prisma.fluidMessage.create({
        data: {
            conversationId,
            role,
            content,
        }
    });
    appendLog('DB - addMessage', performance.now() - start);

    // Update conversation timestamp
    await prisma.fluidConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
    });
}

export async function saveState(conversationId: string, uiConfig: string, dataContext: any) {
    const { orgId, userId } = await getCurrentUserContext();
    if (!userId) throw new Error('Unauthorized');

    const conditions: Prisma.FluidConversationWhereInput[] = [
        { userId: userId, organizationId: null }
    ];
    if (orgId) {
        conditions.push({ organizationId: orgId });
    }

    // Verify access
    const conversation = await prisma.fluidConversation.count({
        where: {
            id: conversationId,
            OR: conditions
        }
    });
    if (conversation === 0) throw new Error('Conversation not found');

    const start = performance.now();
    await prisma.fluidState.create({
        data: {
            conversationId,
            uiConfig,
            dataContext,
        }
    });
    appendLog('DB - saveState', performance.now() - start);
}

export async function getLatestState(conversationId: string) {
    const { orgId, userId } = await getCurrentUserContext();
    if (!userId) return null;

    const conditions: any[] = [
        { userId: userId, organizationId: null }
    ];
    if (orgId) {
        conditions.push({ organizationId: orgId });
    }

    const state = await prisma.fluidState.findFirst({
        where: {
            conversationId,
            conversation: {
                OR: conditions
            }
        },
        orderBy: { timestamp: 'desc' }
    });

    if (!state) return null;

    return {
        uiConfig: state.uiConfig,
        dataContext: state.dataContext,
        timestamp: state.timestamp.toISOString()
    };
}
