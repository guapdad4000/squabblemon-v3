import { chromium, defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

if (process.env.EVENTS_FEEDBACK_TEST_OWNED !== '1' ||
    !process.env.DATABASE_URL ||
    !['localhost', '127.0.0.1', '::1'].includes(new URL(process.env.DATABASE_URL).hostname) ||
    !process.env.EVENTS_E2E_PORT) {
  throw new Error('Events tests require an owned loopback database and the events browser host.');
}
const chromiumExecutable = [
  process.env.EVENTS_CHROMIUM_EXECUTABLE,
  chromium.executablePath(),
  '/repl/tools/bin/chromium',
].find(path => path && existsSync(path));
if (!chromiumExecutable) {
  throw new Error('Events browser checks require a local Chromium executable (set EVENTS_CHROMIUM_EXECUTABLE).');
}
export default defineConfig({
  testDir: '.',
  testMatch: 'events*.spec.ts',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${process.env.EVENTS_E2E_PORT}`,
    browserName: 'chromium',
    launchOptions: { executablePath: chromiumExecutable },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results/events',
});