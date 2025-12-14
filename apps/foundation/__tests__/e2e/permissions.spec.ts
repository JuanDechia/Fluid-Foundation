// __tests__/e2e/permissions.spec.ts
import { test, expect, Page } from '@playwright/test';
import { AUTH_FILE } from './global.setup';
import fs from 'fs/promises';

let sessions: { adminToken: string; memberToken: string; };

test.beforeAll(async () => {
  try {
    const authData = await fs.readFile(AUTH_FILE, 'utf-8');
    sessions = JSON.parse(authData);
  } catch (error) {
    throw new Error(`Could not load auth file. Did the global setup run correctly? 
Error: ${error}`);
  }
});

/**
 * Injects the Clerk session token into the browser context *before* navigation
 * to simulate a logged in user without UI interaction.
 * @param page The Playwright page object.
 * @param role The role to log in as ('admin' or 'member').
 */
async function loginAs(page: Page, role: 'admin' | 'member') {
  const token = role === 'admin' ? sessions.adminToken : sessions.memberToken;
  await page.context().addCookies([
    {
      name: '__session', value: token, domain: 'localhost', path: '/',
    },
  ]);
}

test.describe('Role-Based UI Visibility', () => {
  test('Admin user sees the "Delete Project" button', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/projects');

    // Admin should see delete button
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /delete project/i })).toBeVisible();
  });

  test('Member user does NOT see the "Delete Project" button', async ({ page }) => {
    await loginAs(page, 'member');
    await page.goto('/projects');

    // Member should NOT see delete button
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /delete project/i })).not.toBeVisible();
  });
});
