import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
process.env.PORT ??= '4341'; process.env.BASE_PATH = '/';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.BATTLE_WORKER_OUTPUT ?? '/tmp/squabble-runtime-overhaul-20261025/worker-browser';
const server = await createServer({ root, configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)), cacheDir: `/tmp/squabblemon-worker-${process.pid}`, logLevel: 'error', server: { host: '127.0.0.1', port: 0, strictPort: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], workerUrls = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('worker', worker => workerUrls.push(worker.url()));
  await page.goto(new URL('/e2e/battle-worker.fixture.html', server.resolvedUrls.local[0]).href);
  await page.waitForFunction(() => window.battleWorkerDiagnostic);
  const trials = [];
  for (const count of [12, 36]) {
    const pending = page.evaluate(count => window.battleWorkerDiagnostic.run(count), count);
    await page.locator('#responsive').click();
    const result = await pending;
    assert.equal(result.equal, true, 'actual module worker must match main-thread engine exactly');
    assert.ok(result.timerTicks > 0, 'main event loop must remain available during worker computation');
    assert.ok(result.inputBytes < result.fullBytes, 'worker message excludes accumulated replay boards');
    trials.push(result);
  }
  assert.equal(workerUrls.length, 1, 'one module worker serves the whole session');
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.battleWorkerDiagnostic.dispose());
  await mkdir(output, { recursive: true });
  const report = { evidence: 'development module worker, synthetic engine-generated histories, Chromium phone viewport; no physical-phone or production thermal claim', workerUrls, errors, trials };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); await server.close(); }
