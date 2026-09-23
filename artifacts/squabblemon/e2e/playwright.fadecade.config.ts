import { defineConfig, devices } from '@playwright/test';

const port = 4191;

export default defineConfig({
  testDir: '.',
  testMatch: 'fadecade.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  outputDir: 'test-results/fadecade/artifacts',
  use: {
    baseURL: `http://127.0.0.1:${port}/squabblemon`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'short-phone', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-portrait', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'tablet-landscape', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'reduced-motion', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' } },
  ],
  webServer: {
    command: `PORT=${port} BASE_PATH=/squabblemon pnpm exec vite build --config e2e/vite.fadecade.config.ts && PORT=${port} BASE_PATH=/squabblemon pnpm exec vite preview --config e2e/vite.fadecade.config.ts`,
    cwd: '..',
    url: `http://127.0.0.1:${port}/squabblemon`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});