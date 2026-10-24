import { defineConfig } from '@playwright/test';
const baseURL=process.env.LOADING_BASE_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://127.0.0.1:4242');
export default defineConfig({
  testDir: '.', testMatch: 'loading.spec.ts', fullyParallel: false, workers: 1,
  timeout: 60_000, expect: { timeout: 10_000 },
  use: { baseURL, browserName: 'chromium', launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome' }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'loading-chromium' }],
});
