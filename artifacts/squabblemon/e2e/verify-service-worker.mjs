import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';

const workerSource = await readFile(new URL('../public/sw.js', import.meta.url));
const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/sw.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(workerSource); }
  else if (req.url.startsWith('/assets/')) { res.setHeader('Content-Type', 'text/plain'); res.end('asset-ok'); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Worker regression</title><main>Shell ready</main>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
async function setup() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  const worker = context.serviceWorkers()[0];
  await worker.evaluate(() => {
    self.unhandled = [];
    self.addEventListener('unhandledrejection', event => self.unhandled.push(String(event.reason)));
  });
  return { context, page, worker };
}
try {
  for (const failure of ['UnknownError', 'InvalidAccessError', 'QuotaExceededError', 'open', 'match']) {
    const { context, page, worker } = await setup();
    await worker.evaluate(kind => {
      self.attempts = 0;
      const fail = async () => { self.attempts++; throw new DOMException('Injected storage failure', ['open', 'match'].includes(kind) ? 'UnknownError' : kind); };
      if (kind === 'open') CacheStorage.prototype.open = fail;
      else if (kind === 'match') Cache.prototype.match = fail;
      else Cache.prototype.put = fail;
    }, failure);
    assert.deepEqual(await page.evaluate(async () => Promise.all(Array.from({ length: 8 }, (_, i) => fetch(`/assets/token-${i}.webp`).then(r => r.text())))), Array(8).fill('asset-ok'));
    await page.goto(`${origin}/battle`);
    assert.equal(await page.locator('main').innerText(), 'Shell ready');
    assert.equal(await page.evaluate(() => fetch('/assets/index-Abc12345.js').then(r => r.text())), 'asset-ok');
    assert.deepEqual(await worker.evaluate(() => self.unhandled), []);
    assert.ok(await worker.evaluate(() => self.attempts) > 0, 'injected failure was exercised');
    await context.close();
    console.log(`PASS mobile browser: ${failure} cannot block art, code or navigation`);
  }
  {
    const { context, page, worker } = await setup();
    await worker.evaluate(() => {
      const original = Cache.prototype.put;
      self.activeWrites = 0; self.maxWrites = 0; self.completedWrites = 0;
      const gate = new Promise(resolve => { self.releaseWrites = resolve; });
      Cache.prototype.put = async function (...args) {
        self.activeWrites++; self.maxWrites = Math.max(self.maxWrites, self.activeWrites);
        await gate;
        try { return await original.apply(this, args); }
        finally { self.activeWrites--; self.completedWrites++; }
      };
    });
    assert.deepEqual(await page.evaluate(async () => Promise.all(Array.from({ length: 12 }, (_, i) => fetch(`/assets/concurrent-${i % 3}.webp`).then(r => r.text())))), Array(12).fill('asset-ok'));
    assert.equal(await worker.evaluate(() => self.maxWrites), 1);
    assert.equal(await worker.evaluate(() => self.completedWrites), 0, 'response is not delayed by cache writes');
    await worker.evaluate(() => self.releaseWrites());
    await page.waitForFunction(async () => (await (await caches.open('sq-v3-art')).keys()).length === 3);
    assert.deepEqual(await worker.evaluate(() => self.unhandled), []);
    await context.close();
    console.log('PASS browser: concurrent requests return before serialized writes complete');
  }
  {
    const { context, page, worker } = await setup();
    await page.evaluate(() => fetch('/assets/offline.webp'));
    await page.waitForFunction(async () => Boolean(await (await caches.open('sq-v3-art')).match('/assets/offline.webp')));
    await context.setOffline(true);
    await page.goto(`${origin}/offline-battle`);
    assert.equal(await page.locator('main').innerText(), 'Shell ready');
    assert.equal(await page.evaluate(() => fetch('/assets/offline.webp').then(r => r.text())), 'asset-ok');
    assert.deepEqual(await worker.evaluate(() => self.unhandled), []);
    await context.close();
    console.log('PASS browser: cached shell and art still load offline');
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
