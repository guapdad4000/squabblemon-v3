import { chromium, defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['release-mail.spec.ts', 'patch-desk.spec.ts', 'mary-mack.spec.ts'],
  timeout: 120000, expect: { timeout: 20000 }, workers: 1, reporter: 'list',
  outputDir: '../test-results/release-mail',
  use: { baseURL: 'http://127.0.0.1:4224', headless: true, launchOptions: { executablePath: process.env.RELEASE_MAIL_CHROMIUM_EXECUTABLE ?? chromium.executablePath() } },
  webServer: { command: 'PORT=4224 BASE_PATH=/squabblemon VITE_E2E_AUTH=true VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZTJlLXRlc3Qk pnpm exec vite --host 127.0.0.1 --port 4224', cwd: '..', url: 'http://127.0.0.1:4224/squabblemon/', reuseExistingServer: true, timeout: 60000 },
});
