import { chromium, defineConfig } from '@playwright/test';

const port = Number(process.env.PAYMENT_E2E_PORT || 4319);

export default defineConfig({
  testDir: '.',
  testMatch: 'payment-store.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    launchOptions: { executablePath: chromium.executablePath() },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: '/tmp/squabblemon-payment-store-results',
  projects: [{ name: 'payment-store-mocked-http-chromium' }],
});