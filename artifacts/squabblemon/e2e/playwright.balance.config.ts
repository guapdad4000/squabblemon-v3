import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: [
    'cellblock-wave.spec.ts',
    'neighborhood-wave.spec.ts',
    'crew-balance.spec.ts',
  ],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:80',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
    },
    {
      name: 'chromium-phone',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      },
    },
  ],
});