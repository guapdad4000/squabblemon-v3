import { defineConfig, devices } from '@playwright/test';

const port = 4179;

export default defineConfig({
  testDir: '.',
  testMatch: 'rookie-road.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}/squabblemon`,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `PORT=${port} BASE_PATH=/squabblemon VITE_E2E_AUTH=true VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZTJlLXRlc3Qk pnpm run dev`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/squabblemon`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});