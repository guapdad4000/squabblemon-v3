import { defineConfig } from '@playwright/test';

const port = 4193;
const executablePath = process.env.BROWSER_EXECUTABLE ?? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: '.',
  testMatch: ['media-loading.spec.ts'],
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `PORT=${port} BASE_PATH=/ pnpm exec vite --config vite.config.ts --host 127.0.0.1`,
    cwd: '..',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
