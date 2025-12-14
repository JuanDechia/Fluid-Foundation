
import { vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';

vi.mock('server-only', () => ({}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('../../lib/authorization', () => ({
  authorize: vi.fn(),
  withAuthorization: vi.fn((_, handler) => handler),
  getCurrentUserPermissions: vi.fn(),
}));

beforeEach(async () => {
  execSync('npx prisma migrate reset --force');
});
