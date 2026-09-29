// Native-PG browser entrypoint, invoked only by the owned database runner.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.env.SOCIAL_TEST_OWNED !== '1' || process.env.CAMPAIGN_DATABASE_TESTS !== '1' ||
    !process.env.DATABASE_URL ||
    !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) {
  throw new Error('Use env -u DATABASE_URL node scripts/test-payments-database.mjs --social-browser (owned native PostgreSQL only).');
}
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(import.meta.url);
const env = {
  ...process.env,
  ONLINE_E2E: '1', HOMIES_E2E: '1', CAMPAIGN_E2E_DB_MODE: '1',
  NODE_ENV: 'development', VITE_E2E_AUTH: 'true', PORT: '4196',
  BASE_PATH: '/', PUBLIC_ORIGIN: 'http://127.0.0.1:4196',
  DATABASE_POOL_MAX: '5',
};
const host = spawn(process.execPath, [
  '--import', pathToFileURL(require.resolve('tsx')).href,
  resolve(import.meta.dirname, 'online-server.ts'),
], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
for (const stream of [host.stdout, host.stderr]) {
  stream.on('data', chunk => { output = (output + chunk).slice(-12000); });
}
try {
  await new Promise<void>((done, fail) => {
    const timeout = setTimeout(() => fail(new Error(`Homies test host startup timed out: ${output}`)), 90_000);
    const ready = () => {
      if (!output.includes('Online browser test host:')) return;
      clearTimeout(timeout); host.stdout.off('data', ready); done();
    };
    host.stdout.on('data', ready);
    host.once('error', fail);
    host.once('exit', code => { clearTimeout(timeout); fail(new Error(`Homies host exited ${code}: ${output}`)); });
  });
  process.env.HOMIES_E2E = '1';
  await import('./verify-homies.mjs');
} finally {
  host.kill('SIGTERM');
}