import { defineConfig } from '@playwright/test';

const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error('REPLIT_DEV_DOMAIN is required for the managed-preview bounty suite.');

export default defineConfig({
  testDir: '.',
  testMatch: 'bounty-gang.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `https://${domain}`,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'managed-chromium' }],
});