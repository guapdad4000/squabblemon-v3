import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontend = process.env.RANK_PROMOTION_FRONTEND ?? fileURLToPath(new URL('../', import.meta.url));
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:43247';
const url = new URL(origin);
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname), 'Review uses loopback HTTP');
const env = { ...process.env, PORT: url.port || '80', BASE_PATH: '/', UI_ORIGIN: origin };
const server = spawn(process.execPath, [`${frontend}/node_modules/vite/bin/vite.js`, '--host', url.hostname, '--port', env.PORT, '--strictPort'], { cwd: frontend, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', ready = false, startupError, check;
server.stdout.on('data', data => { process.stdout.write(data); output = (output + data).slice(-12000); ready = output.includes('Local:') && output.includes(url.origin); });
server.stderr.on('data', data => { process.stderr.write(data); output = (output + data).slice(-12000); });
server.once('error', error => { startupError = error; });
const timeout = setTimeout(() => { check?.kill('SIGTERM'); server.kill('SIGTERM'); }, 300000);
try {
  let fetched = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startupError) throw startupError;
    assert.equal(server.exitCode, null, `Owned strict-port preview exited: ${output}`);
    if (ready) try { if ((await fetch(`${origin}/e2e/rank-promotion.fixture.html`)).ok) { fetched = true; break; } } catch { /* Owned preview starts. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(fetched, 'Owned preview serves the rank fixture');
  assert.equal(server.exitCode, null);
  check = spawn(process.execPath, [fileURLToPath(new URL('./verify-rank-promotion.mjs', import.meta.url))], { cwd: frontend, env, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { check.once('error', reject); check.once('exit', resolve); });
  assert.equal(code, 0, 'Rank tier browser regressions pass');
} finally { clearTimeout(timeout); check?.kill('SIGTERM'); server.kill('SIGTERM'); }
