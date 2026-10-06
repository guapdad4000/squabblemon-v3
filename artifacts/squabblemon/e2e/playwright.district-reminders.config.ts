import { chromium, defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'district-reminders.spec.ts', workers: 1, reporter: 'list',
  timeout: 60000, expect: { timeout: 15000 }, outputDir: '../test-results/district-reminders',
  use: { baseURL: 'http://127.0.0.1:4224', headless: true,
    launchOptions: { executablePath: chromium.executablePath() } },
  webServer: { command: 'PORT=4224 BASE_PATH=/squabblemon VITE_E2E_AUTH=true VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZTJlLXRlc3Qk pnpm exec vite --host 127.0.0.1 --port 4224',
    cwd: '..', url: 'http://127.0.0.1:4224/squabblemon/', reuseExistingServer: true, timeout: 60000 },
});
