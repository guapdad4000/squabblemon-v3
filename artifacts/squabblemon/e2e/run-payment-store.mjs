import { spawn } from 'node:child_process';
import process from 'node:process';

const port = process.env.PAYMENT_E2E_PORT || '4319';
const env = {
  ...process.env,
  PAYMENT_E2E_PORT: port,
  VITE_E2E_AUTH: 'false',
  VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_cGF5bWVudC1maXh0dXJlJA',
};
const server = spawn(
  'pnpm',
  ['exec', 'vite', '--config', 'e2e/vite.payment-store.config.ts'],
  { cwd: new URL('..', import.meta.url), env, stdio: ['ignore', 'pipe', 'pipe'] },
);

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  const url = `http://127.0.0.1:${port}/e2e/payment-store.fixture.html`;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Payment fixture server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for payment fixture server.\n${serverOutput}`);
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await new Promise((resolve, reject) => {
    const tests = spawn(
      'pnpm',
      ['exec', 'playwright', 'test', '--config', 'e2e/playwright.payment-store.config.ts', ...process.argv.slice(2)],
      { cwd: new URL('..', import.meta.url), env, stdio: 'inherit' },
    );
    tests.on('error', reject);
    tests.on('exit', code => resolve(code ?? 1));
  });
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => server.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 3_000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

process.exitCode = exitCode;