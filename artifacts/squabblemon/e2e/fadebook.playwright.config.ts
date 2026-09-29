import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Use the repository-provisioned Chromium when the package's default
// headless-shell revision is unavailable. This config does not alter the
// shared Playwright configuration or the managed preview server.
const executablePath = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath) throw new Error('REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE must point to the provisioned Chromium.');

export default defineConfig({
  ...base,
  testMatch: ['fadebook.spec.ts', 'post-match-homie.spec.ts', 'homies.spec.ts', 'homies-guards.spec.ts'],
  projects: base.projects?.filter(project => project.name === 'chromium-desktop' || project.name === 'chromium-phone')
    .map(project => ({
      ...project,
      use: {
        ...project.use,
        launchOptions: { ...project.use?.launchOptions, executablePath },
      },
    })),
});