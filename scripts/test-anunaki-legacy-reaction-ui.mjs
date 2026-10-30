// Run the actual pre-Anunaki reaction editor against a mocked 409 response.
// The server/database guard is tested separately by the native Postgres suite.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), 'squabblemon-legacy-reaction-'));
const oldRevision = '77f44c8b';
let host;
let browser;

function command(program, args, cwd = root) {
  const result = spawnSync(program, args, { cwd, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${program} failed (${result.status})`);
}
async function unusedLoopbackPort() {
  const socket = createServer();
  await new Promise((resolvePromise, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolvePromise); });
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local test port.');
  await new Promise((resolvePromise, reject) => socket.close(error => error ? reject(error) : resolvePromise()));
  return address.port;
}
try {
  const archive = join(scratch, 'legacy.tar');
  command('git', ['archive', `--output=${archive}`, oldRevision, 'artifacts/squabblemon/src', 'artifacts/squabblemon/vite.config.ts', 'artifacts/squabblemon/package.json', 'lib/squabblemon-engine', 'lib/api-client-react', 'tsconfig.base.json']);
  command('tar', ['-xf', archive, '-C', scratch]);
  // Reuse installed dependencies and read-only assets; the component itself
  // is the source archived from the old revision.
  for (const path of ['node_modules', 'artifacts/squabblemon/node_modules', 'artifacts/squabblemon/public', 'lib/squabblemon-engine/node_modules', 'lib/api-client-react/node_modules'])
    symlinkSync(join(root, path), join(scratch, path), 'dir');
  const app = join(scratch, 'artifacts/squabblemon');
  const port = await unusedLoopbackPort();
  writeFileSync(join(app, 'legacy-reaction.html'), '<div id="root"></div><script type="module" src="/legacy-reaction.tsx"></script>');
  writeFileSync(join(app, 'legacy-reaction.tsx'), `import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PvpReactionCollection } from './src/components/profile/PvpReactionCollection';
const bootstrap: any = { profile: { id: 'fixture', unlockedCosmeticIds: [], settings: { reactionTray: ['big-w', 'lets-go'], reducedMotion: true } } };
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><PvpReactionCollection bootstrap={bootstrap}/></QueryClientProvider>);
`);
  writeFileSync(join(app, 'legacy-reaction.config.mjs'), `import legacy from './vite.config.ts'; export default { ...legacy, cacheDir: ${JSON.stringify(join(scratch, 'vite-cache'))} };`);
  host = spawn(process.execPath, [join(root, 'artifacts/squabblemon/node_modules/vite/bin/vite.js'), '--config', 'legacy-reaction.config.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: app, env: { ...process.env, PORT: String(port), BASE_PATH: '/' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [host.stdout, host.stderr]) stream.on('data', chunk => { output += String(chunk); });
  const deadline = Date.now() + 20_000;
  while (!output.includes('Local:') && Date.now() < deadline) {
    if (host.exitCode !== null) throw new Error(`Legacy fixture failed to start: ${output}`);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
  }
  if (!output.includes('Local:')) throw new Error(`Legacy fixture startup timed out: ${output}`);
  const { chromium } = createRequire(join(root, 'artifacts/squabblemon/package.json'))('playwright');
  const executablePath = process.env.BROWSER_PATH ?? ['/repl/tools/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
  if (!executablePath) throw new Error('No Chromium executable found; set BROWSER_PATH.');
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const expected = 'Refresh the game before editing your reaction tray. Your saved reactions are safe.';
  let patchSeen = false;
  await page.route('**/api/player/profile', async route => {
    assert.equal(route.request().method(), 'PATCH');
    assert.equal(route.request().headers()['x-squabblemon-capabilities'], undefined, 'old editor must omit the new capability');
    patchSeen = true;
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: expected }) });
  });
  await page.goto(`http://127.0.0.1:${port}/legacy-reaction.html`);
  await page.getByTestId('button-reaction-remove-big-w').click();
  await page.getByTestId('button-reaction-tray-save').click();
  await page.getByTestId('status-reaction-tray').getByText(expected).waitFor();
  assert.ok(patchSeen, 'legacy editor submitted a profile update');
  assert.equal(await page.getByTestId('button-reaction-remove-lets-go').count(), 1, 'failed save retains the draft');
  console.log('PASS: pre-Anunaki editor shows the mocked 409 refresh message and retains the draft.');
} finally {
  await browser?.close();
  if (host && host.exitCode === null && host.signalCode === null) {
    host.kill('SIGTERM');
    await new Promise(resolvePromise => host.once('exit', resolvePromise));
  }
  rmSync(scratch, { recursive: true, force: true });
}
