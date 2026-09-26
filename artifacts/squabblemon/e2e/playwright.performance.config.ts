import { defineConfig } from '@playwright/test';

const port = 4186;
export default defineConfig({
  testDir: '.',
  testMatch: ['loading.spec.ts', 'performance.spec.ts', 'battle-start-smoke.spec.ts'],
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', screenshot: 'only-on-failure' },
  webServer: {
    command: `PORT=${port} BASE_PATH=/ VITE_E2E_AUTH=true VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZTJlLXRlc3Qk pnpm run dev`,
    cwd: '..', url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI,
  },
});
