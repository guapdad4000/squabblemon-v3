import { chromium, defineConfig } from '@playwright/test';

const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error('REPLIT_DEV_DOMAIN is required for the managed-preview broadcast suite.');

export default defineConfig({
  testDir: '.',
  testMatch: 'broadcast*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL: `https://${domain}`,
    browserName: 'chromium',
    launchOptions: { executablePath: chromium.executablePath() },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'managed-chromium' }],
});