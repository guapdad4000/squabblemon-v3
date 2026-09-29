import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';

const url = process.env.DATABASE_URL && new URL(process.env.DATABASE_URL);
if (process.env.EVENTS_FEEDBACK_TEST_OWNED !== '1' ||
    !url || !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  throw new Error('Refusing to run events browser checks without EVENTS_FEEDBACK_TEST_OWNED=1 and a loopback DATABASE_URL.');
}
const port = await new Promise((resolve, reject) => {
  const socket = createServer();
  socket.once('error', reject);
  socket.listen(0, '127.0.0.1', () => {
    const chosen = socket.address().port;
    socket.close(() => resolve(chosen));
  });
});
const env = {
  ...process.env, EVENTS_E2E_PORT: String(port), PORT: String(port),
  BASE_PATH: '/squabblemon', VITE_E2E_AUTH: 'true',
  VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_ZTJlLXRlc3Qk',
};
const cwd = new URL('..', import.meta.url);
const host = spawn('pnpm', ['exec', 'tsx', 'artifacts/squabblemon/e2e/events-server.ts'], {
  cwd: new URL('../../..', import.meta.url), env, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
host.stdout.on('data', data => { output += data; });
host.stderr.on('data', data => { output += data; });
async function ready() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (host.exitCode !== null) throw new Error(`Events test host exited early:\n${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/squabblemon/game/events`);
      if (response.ok) return;
    } catch { /* Not yet listening. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for events test host:\n${output}`);
}
let code = 1;
try {
  await ready();
  code = await new Promise((resolve, reject) => {
    const tests = spawn('pnpm', ['exec', 'playwright', 'test', '--config', 'e2e/playwright.events.config.ts', ...process.argv.slice(2)], {
      cwd, env, stdio: 'inherit',
    });
    tests.on('error', reject);
    tests.on('exit', value => resolve(value ?? 1));
  });
} finally {
  host.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => host.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
  if (host.exitCode === null) host.kill('SIGKILL');
}
process.exitCode = code;