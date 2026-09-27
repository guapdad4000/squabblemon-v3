import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
const cwd = fileURLToPath(new URL('../artifacts/squabblemon/', import.meta.url));
const env = { ...process.env, PORT: '4218', BASE_PATH: '/', NODE_ENV: 'development' };
delete env.REPL_ID;

async function resolveRuntime(cacheDir) {
  const source = `
    import { resolveConfig } from 'vite';
    const config = await resolveConfig({
      configFile: 'vite.config.ts',
      ...${JSON.stringify(cacheDir ? { cacheDir } : {})}
    }, 'serve');
    console.log('RUNTIME ' + JSON.stringify({
      pid: process.pid, cacheDir: config.cacheDir,
      dedupe: config.resolve.dedupe, strictPort: config.server.strictPort
    }));
  `;
  const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', source], { cwd, env });
  const result = stdout.split('\n').find(line => line.startsWith('RUNTIME '));
  assert.ok(result, 'Vite must report its resolved runtime configuration');
  return JSON.parse(result.slice('RUNTIME '.length));
}

// Deliberately use the same port: failed replacement servers can still optimize
// dependencies, so isolating only by port or auth mode does not protect React.
const [first, second] = await Promise.all([resolveRuntime(), resolveRuntime()]);
assert.notEqual(first.pid, second.pid);
assert.notEqual(first.cacheDir, second.cacheDir, 'Concurrent Vite processes must not overwrite each other’s React cache');
for (const runtime of [first, second]) {
  assert.ok(runtime.cacheDir.endsWith(`/${runtime.pid}`));
  assert.ok(runtime.dedupe.includes('react'));
  assert.ok(runtime.dedupe.includes('react-dom'));
  assert.equal(runtime.strictPort, true);
}

const fixtureCache = join(tmpdir(), `squabblemon-runtime-fixture-${process.pid}`);
const fixture = await resolveRuntime(fixtureCache);
assert.equal(fixture.cacheDir, fixtureCache, 'Explicitly isolated browser fixtures must retain their own cache');
console.log('PASS: same-port Vite processes have isolated React caches; singleton resolution and fixture overrides are preserved.');