import fs from 'fs';
import path from 'path';

export function appendLog(event: string, duration: number, metadata?: any) {
    try {
        const logFile = path.join(process.cwd(), 'performance.log');
        const timestamp = new Date().toISOString();
        const metaString = metadata ? ` | Meta: ${JSON.stringify(metadata)}` : '';
        const entry = `[${timestamp}] ${event}: ${duration}ms${metaString}\n`;

        fs.appendFileSync(logFile, entry, 'utf8');
    } catch (e) {
        console.error('Failed to write to performance log', e);
    }
}
