import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Own and stop only this loopback preview. Real application entry/route CSS is
// required; the isolated Kumite component review cannot detect body scroll locks.
const frontend = process.env.KUMITE_FRONTEND ?? fileURLToPath(new URL('../', import.meta.url));
const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:43235';
const url = new URL(origin);
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname), 'Mobile review runs only on loopback HTTP');
const env = { ...process.env, PORT: url.port || '80', BASE_PATH: '/', VITE_E2E_AUTH: 'true',
  // The DEV-only test auth provider bypasses Clerk. This documented dummy key
  // satisfies App's startup shape check and cannot authenticate a real account.
  VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_bG9jYWxob3N0JA==', KUMITE_ORIGIN: origin };
const server = spawn(process.execPath, [`${frontend}/node_modules/vite/bin/vite.js`, '--host', url.hostname, '--port', env.PORT, '--strictPort'], { cwd: frontend, env, stdio: ['ignore', 'pipe', 'pipe'] });
let startupOutput = '', startupError = null, serverReady = false;
server.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  startupOutput = (startupOutput + chunk).slice(-12000);
  // A successful fetch alone can accidentally reach somebody else's preview
  // before this strict-port child reports EADDRINUSE. Require our child's bind.
  serverReady = startupOutput.includes('Local:') && startupOutput.includes(url.origin);
});
server.stderr.on('data', chunk => { process.stderr.write(chunk); startupOutput = (startupOutput + chunk).slice(-12000); });
server.once('error', error => { startupError = error; });
let check;
const timeout = setTimeout(() => { check?.kill('SIGTERM'); server.kill('SIGTERM'); }, 300000);
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startupError) throw startupError;
    assert.equal(server.exitCode, null, `Owned strict-port preview exited before readiness: ${startupOutput}`);
    if (serverReady) try { if ((await fetch(`${origin}/`)).ok) { ready = true; break; } } catch { /* Owned server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Actual application preview is ready');
  assert.equal(server.exitCode, null, 'Owned preview is still running');
  check = spawn(process.execPath, [fileURLToPath(new URL('./verify-kumite-mobile.mjs', import.meta.url))], { cwd: frontend, env, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { check.once('error', reject); check.once('exit', resolve); });
  assert.equal(code, 0, 'Real-route mobile touch checks pass');
} finally { clearTimeout(timeout); check?.kill('SIGTERM'); server.kill('SIGTERM'); }
