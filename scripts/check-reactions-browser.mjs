import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
if (process.env.CAMPAIGN_DATABASE_TESTS !== '1' || process.env.ONLINE_E2E_REACTIONS !== '1' ||
    !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).hostname !== '127.0.0.1')
  throw new Error('Run via pnpm exec node scripts/test-api-database.mjs reactions-browser (owned loopback PGlite only).');
const env = { ...process.env, ONLINE_E2E: '1', NODE_ENV: 'development', VITE_E2E_AUTH: 'true', PORT: '4196', BASE_PATH: '/', PUBLIC_ORIGIN: 'http://127.0.0.1:4196', DATABASE_POOL_MAX: '1' };
const host = spawn(process.execPath, ['--import', pathToFileURL(require.resolve('tsx', { paths: [process.cwd() + '/artifacts/api-server'] })).href, 'artifacts/squabblemon/e2e/online-server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
for (const stream of [host.stdout, host.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-10000); });
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Reactions test host startup timed out: ' + output)), 60_000);
    const ready = chunk => { if (String(chunk).includes('Online browser test host:') || output.includes('Online browser test host:')) { clearTimeout(timeout); host.stdout.off('data', ready); resolve(); } };
    host.stdout.on('data', ready);
    host.once('error', reject);
    host.once('exit', code => { clearTimeout(timeout); reject(new Error(`Reactions test host exited ${code}: ${output}`)); });
  });
  const code = await new Promise((resolve, reject) => {
    const test = spawn(process.execPath, ['artifacts/squabblemon/e2e/verify-reactions.mjs'], { env, stdio: 'inherit' });
    test.once('error', reject); test.once('exit', resolve);
  });
  if (code !== 0) process.exitCode = code ?? 1;
} finally {
  host.kill('SIGTERM');
}