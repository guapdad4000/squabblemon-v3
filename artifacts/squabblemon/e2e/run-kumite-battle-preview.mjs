import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:43217';
const url = new URL(origin);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('The isolated battle preview must run on loopback');
let server;
let verifier;
const timeout = setTimeout(() => { verifier?.kill('SIGTERM'); server?.kill('SIGTERM'); }, 180000);
async function available() {
  try { return (await fetch(`${origin}/e2e/kumite-battle.fixture.html`, { signal: AbortSignal.timeout(1000) })).ok; }
  catch { return false; }
}
try {
  if (!await available()) {
    server = spawn('pnpm', ['exec', 'vite', '--config', 'vite.config.ts', '--host', url.hostname], {
      cwd, env: { ...process.env, PORT: url.port || '80', BASE_PATH: '/' }, stdio: ['ignore', 'ignore', 'inherit'],
    });
    for (let attempt = 0; !await available(); attempt++) {
      if (server.exitCode !== null || attempt >= 100) throw new Error('Kumite preview could not start');
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  verifier = spawn(process.execPath, ['e2e/verify-kumite-battle.mjs'], {
    cwd, env: { ...process.env, KUMITE_ORIGIN: origin }, stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => {
    verifier.once('error', reject);
    verifier.once('exit', code => resolve(code));
  });
  if (code !== 0) throw new Error(`Kumite battle verification exited ${code}`);
} finally {
  clearTimeout(timeout);
  verifier?.kill('SIGTERM');
  server?.kill('SIGTERM');
}
