import Dexie, { type EntityTable } from 'dexie';

// Interfaces associated with our DB Schema
export interface Conversation {
    id: number;
    title: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Message {
    id: number;
    conversationId: number;
    role: 'user' | 'model' | 'system';
    content: string;
    timestamp: Date;
}

export interface FluidStateEntry {
    id: string; // UUID from crypto
    conversationId: number;
    uiConfig: string;
    dataContext: any;
    timestamp: number;
}

// Database definition
export class FluidDatabase extends Dexie {
    conversations!: EntityTable<Conversation, 'id'>;
    messages!: EntityTable<Message, 'id'>;
    fluidStates!: EntityTable<FluidStateEntry, 'id'>;

    constructor() {
        super('FluidDatabase');
        this.version(1).stores({
            conversations: '++id, title, createdAt, updatedAt',
            messages: '++id, conversationId, role, timestamp',
            fluidStates: 'id, conversationId, timestamp'
        });
    }
}

export const db = new FluidDatabase();
