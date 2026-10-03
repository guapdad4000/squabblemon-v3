import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['crew-balance.spec.ts', 'rivalry-playtest.spec.ts'], grep: /Combo base buffs|Blood base buffs|Blood trained|Crip leader|shared-screen/,
  workers: 1, timeout: 90_000,
  use: { baseURL: process.env.PLAYTEST_BASE_URL ?? 'http://localhost:5178', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
