import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Uses the dev-only test account; production authentication is never bypassed.
const origin = process.env.PERF_ORIGIN ?? 'http://127.0.0.1:4186';
const output = path.resolve(process.env.PERF_OUTPUT ?? '../../artifacts/deliverables/performance-review/current');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const report = [];
try {
  for (const [device, width, height] of [['desktop', 1440, 960], ['phone', 390, 844]]) {
    for (const route of (process.env.PERF_ROUTES ?? '/game,/game/collection,/game/shop,/game/challenges').split(',')) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        localStorage.setItem('squabblemon_e2e_user', 'signed-in');
        window.__perf = { longTasks: [], anchors: 0 };
        new PerformanceObserver(list => window.__perf.longTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask' });
        addEventListener('message', e => { if (e.data?.type === 'anchors') window.__perf.anchors++; });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && message.text().includes('ErrorBoundary caught')) errors.push(message.text()); });
      await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: 'null' }));
      const started = Date.now();
      await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
      await page.locator('.game-shell, .immersive-shell').first().waitFor({ timeout: 30000 });
      if (route === '/game') await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor({ timeout: 30000 });
      const readyMs = Date.now() - started;
      await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3000))]));
      await page.waitForTimeout(2500);
      const anchors = await page.evaluate(() => window.__perf.anchors);
      const frame = page.frames().find(f => f.url().includes('/scenes/safehouse/'));
      const scene = frame ? await frame.evaluate(() => window.Squabblemon.getSceneStatus()) : null;
      const beforeMetrics = await page.evaluate(() => window.__perf.longTasks.length);
      await page.waitForTimeout(1500);
      const metrics = await page.evaluate(({ anchors, beforeMetrics }) => ({
        ...window.__perf, idleAnchors: window.__perf.anchors - anchors,
        idleLongTasks: window.__perf.longTasks.length - beforeMetrics,
        resources: performance.getEntriesByType('resource').map(e => ({ name: new URL(e.name).pathname, bytes: e.decodedBodySize, duration: e.duration })),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }), { anchors, beforeMetrics });
      const name = `${device}-${route.split('/').filter(Boolean).join('-')}`;
      await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
      assert.equal(metrics.overflow, false, `${name}: no horizontal overflow`);
      assert.deepEqual(errors, [], `${name}: no runtime errors`);
      report.push({ device, route, readyMs, scene, errors, ...metrics });
      console.log(JSON.stringify({ device, route, readyMs, requests: metrics.resources.length, idleAnchors: metrics.idleAnchors, errors }));
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'navigation.json'), JSON.stringify(report, null, 2));
}
