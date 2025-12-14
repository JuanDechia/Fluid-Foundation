
import { test, expect } from '@playwright/test';

test.describe('Permissions', () => {
  test('user with PROJECT_DELETE permission can see the delete button', async ({ page }) => {
    await page.goto('/test');

    // Mock the getMyPermissions server action to return the PROJECT_DELETE permission
    await page.evaluate(() => {
      (window as any).__NEXT_DATA__.props.pageProps.permissions = ['PROJECT_DELETE'];
    });

    await page.reload();

    const deleteButton = page.locator('button', { hasText: 'Delete Project' });
    await expect(deleteButton).toBeVisible();
  });

  test('user without PROJECT_DELETE permission cannot see the delete button', async ({ page }) => {
    await page.goto('/test');

    // Mock the getMyPermissions server action to return an empty array of permissions
    await page.evaluate(() => {
      (window as any).__NEXT_DATA__.props.pageProps.permissions = [];
    });

    await page.reload();

    const deleteButton = page.locator('button', { hasText: 'Delete Project' });
    await expect(deleteButton).not.toBeVisible();
  });
});
