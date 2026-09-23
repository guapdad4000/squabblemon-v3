import { defineConfig, devices } from '@playwright/test';

const port = 4188;

export default defineConfig({
  testDir: '.',
  testMatch: 'fighter-id.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: '../test-results/fighter-id',
  use: {
    baseURL: `http://127.0.0.1:${port}/squabblemon`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'production-chromium',
    use: { ...devices['Desktop Chrome'], reducedMotion: 'no-preference' },
  }],
  webServer: {
    command: `PORT=${port} BASE_PATH=/squabblemon pnpm exec vite build --config e2e/vite.fighter-id.config.ts && PORT=${port} BASE_PATH=/squabblemon pnpm exec vite preview --config e2e/vite.fighter-id.config.ts`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/squabblemon`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});