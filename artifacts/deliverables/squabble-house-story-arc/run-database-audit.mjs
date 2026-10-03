import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { assertCampaignDatabaseTarget, assertOwnedPgliteReady } from '../../../scripts/database-safety.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const token = randomUUID();
const owned = spawn(process.execPath, ['artifacts/gameplay-test-db/server.mjs'], {
  cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, DATABASE_URL: '', PGLITE_PORT: '0', PGLITE_READY_TOKEN: token },
});
try {
  const identity = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Owned test database did not become ready')), 20_000);
    owned.on('error', reject);
    owned.on('exit', code => reject(new Error(`Owned database exited early: ${code}`)));
    owned.stdout.setEncoding('utf8');
    owned.stdout.on('data', chunk => {
      output += chunk;
      if (!output.includes('\n')) return;
      try { const result = assertOwnedPgliteReady(JSON.parse(output.split('\n')[0]), token); clearTimeout(timer); resolve(result); }
      catch (error) { clearTimeout(timer); reject(error); }
    });
  });
  const environment = { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${identity.port}/postgres`, DATABASE_POOL_MAX: '1', CAMPAIGN_DATABASE_TESTS: '1' };
  assertCampaignDatabaseTarget(environment);
  const schema = spawnSync(process.execPath, ['lib/db/node_modules/drizzle-kit/bin.cjs', 'push', '--config', 'artifacts/gameplay-test-db/drizzle.config.ts'], { cwd: root, env: environment, encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  if (schema.status !== 0) throw new Error(`Schema setup failed: ${schema.stderr || schema.stdout}`);
  console.log('Schema applied only to token-verified owned in-memory loopback database.');
  const suite = spawnSync('pnpm', ['--filter', '@workspace/api-server', 'exec', 'tsx', '--test', '--test-concurrency=1', 'src/lib/storyPuzzleTransactions.test.ts', 'src/lib/storySquabbleHouseTransactions.test.ts'], { cwd: root, env: environment, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  const output = `${suite.stdout ?? ''}\n${suite.stderr ?? ''}`;
  mkdirSync(new URL('puzzle-audit/', import.meta.url), { recursive: true });
  writeFileSync(new URL('puzzle-audit/database-results.txt', import.meta.url), output);
  process.stdout.write(output);
  if (suite.status !== 0 || !/# fail 0/.test(output) || !/# skipped 0/.test(output)) throw new Error('Database audit did not pass without skips');
} finally { owned.kill('SIGTERM'); }
