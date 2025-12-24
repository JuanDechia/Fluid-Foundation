'use server';

import { appendLog } from '@/lib/logger';

export async function logClientEvent(event: string, duration: number, metadata?: any) {
    appendLog(event, duration, metadata);
}
