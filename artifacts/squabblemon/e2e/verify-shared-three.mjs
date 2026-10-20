import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, symlink, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const port = process.env.SHARED_THREE_PORT || '4199';
const origin = `http://127.0.0.1:${port}`;
const base = (process.env.SHARED_THREE_BASE_PATH || '/').replace(/\/?$/, '/');
const built = process.env.SHARED_THREE_BUILD === '1';
let buildDirectory;
if (built) {
  process.env.PORT = port;
  process.env.BASE_PATH = base;
  buildDirectory = await mkdtemp(path.join(tmpdir(), 'squabble-three-browser-'));
  const { build } = await import('vite');
  await build({ logLevel: 'error', build: {
    outDir: buildDirectory, copyPublicDir: false,
    rollupOptions: { input: path.resolve('e2e/shared-three.fixture.html') },
  } });
  // Serve original public media beside built JS without copying gigabytes of art.
  for (const directory of ['', 'assets']) {
    for (const name of await readdir(path.join('public', directory))) {
      const target = path.join(buildDirectory, directory, name);
      try { await symlink(path.resolve('public', directory, name), target); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  }
}
const server = spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', ...(built ? ['preview', '--outDir', buildDirectory] : []), '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
  env: { ...process.env, PORT: port, BASE_PATH: base }, stdio: 'ignore',
});
let browser;
const url = `${origin}${base}e2e/shared-three.fixture.html?gpuTier=low`;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    assert.ok(attempt < 80, 'Vite starts');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (/Multiple instances of Three|shader error/i.test(event.text())) errors.push(event.text()); });
  const failures = [];
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const pendingImport = page.waitForRequest('**/scenes/shared/three.module.js');
  await page.route('**/scenes/shared/three.module.js', async route => { await gate; await route.continue(); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await pendingImport;
  await page.getByRole('button', { name: 'Toggle deck', exact: true }).click();
  release();
  // Load the same URL after releasing the gate, so the original import has settled.
  await page.evaluate(path => import(path), `${base}scenes/shared/three.module.js`);
  assert.equal(await page.locator('.deck-box__canvas').count(), 0, 'Unmount during import allocates no deck canvas');
  await page.getByRole('button', { name: 'Toggle deck', exact: true }).click();
  await page.locator('.deck-box[data-rendered=true] canvas').waitFor();
  await page.getByRole('button', { name: 'Toggle foil', exact: true }).click();
  await page.locator('.collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
  assert.equal(await page.getByAltText('Buddy Bud').evaluate(image => image.complete && image.naturalWidth > 0), true, 'Summoned token portrait loads');
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole('button', { name: 'Toggle deck', exact: true }).click();
    assert.equal(await page.locator('.deck-box__canvas').count(), 0);
    assert.equal(await page.locator('.collector-webgl canvas').count(), 1, 'Deck disposal preserves foil');
    await page.getByRole('button', { name: 'Toggle deck', exact: true }).click();
    await page.locator('.deck-box[data-rendered=true] canvas').waitFor();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.querySelector('.deck-box__canvas, .collector-webgl canvas'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.deck-box[data-rendered=true] canvas').waitFor();
  await page.locator('.collector-webgl[data-foil-renderer=webgl] canvas').waitFor();
  await page.getByRole('button', { name: 'Toggle avatar', exact: true }).click();
  await page.locator('.fa-avatar__canvas canvas').waitFor();
  await page.waitForFunction(() => !document.querySelector('.fa-avatar__still'));
  if (process.env.SHARED_THREE_CAPTURE) {
    await mkdir(process.env.SHARED_THREE_CAPTURE, { recursive: true });
    await page.screenshot({ path: path.join(process.env.SHARED_THREE_CAPTURE, 'shared-three-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(process.env.SHARED_THREE_CAPTURE, 'shared-three-mobile.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'Toggle avatar', exact: true }).click();
  assert.equal(await page.locator('.fa-avatar__canvas canvas').count(), 0);
  assert.equal(await page.locator('.collector-webgl canvas').count(), 1);
  assert.deepEqual(failures, []);
  assert.deepEqual(errors, []);
  console.log(`PASS (${built ? 'production build' : 'development'}, ${base}): shared Three runtime, delayed-import unmount, simultaneous deck/foil rendering, alley avatar model loading, disposal, reduced-motion recovery, Buddy portrait; no duplicate warning or failed resources.`);
} finally {
  await browser?.close();
  server.kill();
  if (buildDirectory) await rm(buildDirectory, { recursive: true, force: true });
}
