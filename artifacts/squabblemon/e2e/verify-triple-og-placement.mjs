import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Preserve the existing verification entry point while routing it through the
// isolated Playwright harness, which supplies the fixture root and VITE_E2E_AUTH.
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('pnpm', [
  'exec',
  'playwright',
  'test',
  '--config',
  'e2e/playwright.config.ts',
  'e2e/battle-triple-og-locked.spec.ts',
], { cwd: packageRoot, env: process.env, stdio: 'inherit' });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;