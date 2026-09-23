import { chromium, defineConfig } from '@playwright/test';

const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error('REPLIT_DEV_DOMAIN is required for the managed-preview loading suite.');

export default defineConfig({
  testDir: '.',
  testMatch: 'loading.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `https://${domain}`,
    browserName: 'chromium',
    launchOptions: { executablePath: chromium.executablePath() },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'managed-chromium' }],
});