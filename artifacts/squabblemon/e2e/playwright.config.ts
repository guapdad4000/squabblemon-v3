import { defineConfig, devices } from '@playwright/test';

const port = 4179;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}/squabblemon`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], reducedMotion: 'no-preference' } },
    { name: 'phone', use: { ...devices['Pixel 7'], reducedMotion: 'reduce' } },
  ],
  webServer: {
    command: `PORT=${port} BASE_PATH=/squabblemon VITE_E2E_AUTH=true VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZTJlLXRlc3Qk pnpm run dev`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/squabblemon`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});