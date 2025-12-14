
import { execSync } from 'child_process';
import { chromium } from '@playwright/test';

export default async function () {
  execSync('npx prisma migrate reset --force');
  execSync('npx prisma db seed');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // You may need to log in here if your app requires authentication

  await page.close();
  await browser.close();
}
