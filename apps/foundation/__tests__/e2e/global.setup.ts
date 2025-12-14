// __tests__/e2e/global.setup.ts
import { FullConfig } from '@playwright/test';
import { clerkClient } from '@clerk/nextjs/server';
import { PrismaClient } from '@prisma/client';
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

export const AUTH_FILE = path.join(__dirname, '.auth/user-sessions.json');

/**
 * Runs once before all E2E tests. It prepares the environment by:
 * 1. Resetting and seeding the database for a consistent state.
 * 2. Programmatically fetching real Clerk session tokens for test users.
 * 3. Saving tokens to a file to be consumed by tests, avoiding slow UI logins.
 */
async function globalSetup(config: FullConfig) {
    console.log('\n🚀 Preparing E2E test environment...');

    if (!process.env.CLERK_SECRET_KEY) {
        throw new Error("CLERK_SECRET_KEY is not defined. Please create a .env.test.local file.");
    }

    // Instantiate PrismaClient inside the setup function so we don't create a client
    // at module import time (which can fail when DATABASE_URL is not defined).
    try {
        console.log('Resetting and seeding database for E2E tests...');
        await execa('npx', ['prisma', 'db', 'push', '--accept-data-loss'], { stdio: 'inherit' });
        await execa('npx', ['prisma', 'db', 'seed'], { stdio: 'inherit' });
    } catch (error) {
        console.error('❌ Failed to reset or seed the database for E2E tests.');
        console.error(error);
        process.exit(1);
    }

    const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    const adminRole = await prisma.role.findFirstOrThrow({ where: { name: 'Admin' } });
    const memberRole = await prisma.role.findFirstOrThrow({ where: { name: 'Member' } });
    const adminMembership = await prisma.organizationMembership.findFirstOrThrow({ where: { roleId: adminRole.id } });
    const memberMembership = await prisma.organizationMembership.findFirstOrThrow({ where: { roleId: memberRole.id } });


    console.log('Generating authentication tokens for E2E tests...');

    let adminToken: string;
    let memberToken: string;

    // Skip real Clerk API calls if using mock credentials
    if (process.env.CLERK_SECRET_KEY === 'sk_test_mock') {
        console.log('Using mock authentication tokens for E2E tests...');
        adminToken = 'mock_admin_token';
        memberToken = 'mock_member_token';
    } else {
        // Clerk types may not declare `getToken` on `users` in some SDK versions used in CI/local.
        // Cast to `any` to keep the runtime behavior while avoiding type errors during `tsc`.
        adminToken = await (clerkClient.users as any).getToken(adminMembership.userId, 'session');
        memberToken = await (clerkClient.users as any).getToken(memberMembership.userId, 'session');
    }


    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ adminToken, memberToken }));

    await prisma.$disconnect();
    console.log('✅ E2E environment is ready.');
}

export default globalSetup;
