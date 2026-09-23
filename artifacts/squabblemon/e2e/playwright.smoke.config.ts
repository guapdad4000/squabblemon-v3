import fs from 'node:fs';
import { chromium, defineConfig, devices, webkit, type Project } from '@playwright/test';

const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error('REPLIT_DEV_DOMAIN is required for the managed-preview smoke suite.');

const chromiumPath = chromium.executablePath();
const webkitPath = webkit.executablePath();
const mobileRegression = /@viewport|four seconds|natural completion|blocked WebM|rematch/;
if (!fs.existsSync(chromiumPath)) {
  throw new Error(`Playwright Chromium is not installed at its configured executablePath: ${chromiumPath}`);
}

const projects: Project[] = [
  {
    name: 'chromium-desktop',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: { executablePath: chromiumPath },
      reducedMotion: 'no-preference',
    },
  },
  {
    name: 'android-chromium',
    grep: mobileRegression,
    use: {
      ...devices['Pixel 7'],
      launchOptions: { executablePath: chromiumPath },
      reducedMotion: 'no-preference',
    },
  },
  {
    name: 'iphone-chromium',
    grep: mobileRegression,
    use: {
      ...devices['iPhone 13'],
      browserName: 'chromium',
      launchOptions: { executablePath: chromiumPath },
      reducedMotion: 'no-preference',
    },
  },
];

// A downloaded WebKit binary still needs host libraries unavailable on some
// Nix workspaces. Opt in on a Safari-capable runner; never disguise Chromium
// viewport checks as actual Safari coverage.
if (process.env.SMOKE_WEBKIT === '1') {
  if (!fs.existsSync(webkitPath)) throw new Error(`Install Playwright WebKit at ${webkitPath}`);
  projects.push({
    name: 'iphone-webkit',
    grep: mobileRegression,
    use: {
      ...devices['iPhone 13'],
      launchOptions: { executablePath: webkitPath },
      reducedMotion: 'no-preference',
    },
  });
}

export default defineConfig({
  testDir: '.',
  testMatch: 'battle-start-smoke.spec.ts',
  fullyParallel: false,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `https://${domain}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects,
});
