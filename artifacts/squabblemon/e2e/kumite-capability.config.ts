import { defineConfig, devices } from '@playwright/test';
const port = 4258;
export default defineConfig({ testDir: '.', testMatch: 'kumite-capability.spec.ts', workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}/squabblemon` },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'phone', use: { ...devices['Pixel 7'], reducedMotion: 'reduce' } }],
  webServer: { command: `PORT=${port} BASE_PATH=/squabblemon VITE_E2E_AUTH=true VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZTJlLXRlc3Qk pnpm exec vite --config vite.config.ts --host 127.0.0.1 --strictPort`, cwd: '..', url: `http://127.0.0.1:${port}/squabblemon/`, reuseExistingServer: false, timeout: 120000 },
});
