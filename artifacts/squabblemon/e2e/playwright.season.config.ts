import { defineConfig, devices } from '@playwright/test';

const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error('REPLIT_DEV_DOMAIN is required for the managed-preview season suite.');

export default defineConfig({
  testDir: '.',
  testMatch: 'season-theater.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `https://${domain}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'managed-chromium',
    use: { ...devices['Desktop Chrome'] },
  }],
});