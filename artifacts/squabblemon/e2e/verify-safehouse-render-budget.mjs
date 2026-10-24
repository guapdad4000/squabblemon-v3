import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.REVIEW_OUTPUT ?? '/tmp/safehouse-refinement';
const baseline = process.env.SAFEHOUSE_BASELINE_REF ?? '7414afd0';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/google-chrome', args: ['--enable-unsafe-swiftshader'] });
const report = { tier: 'low', viewport: [1440, 1000], baseline, scope: 'Same local Chromium/SwiftShader scene; rendered complexity and controlled lifecycle checks, not device FPS proof', results: {} };
try {
  for (const version of ['baseline', 'current']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    if (version === 'baseline') for (const name of ['scene.js', 'room-details.js', 'camera-limits.js']) {
      const body = execFileSync('git', ['show', `${baseline}:artifacts/squabblemon/public/scenes/safehouse/${name}`], { encoding: 'utf8' });
      await page.route(`**/scenes/safehouse/${name}`, route => route.fulfill({ contentType: 'application/javascript', body }));
    }
    await page.addInitScript(() => { window.qaFrames = 0; const request = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = callback => request(time => { window.qaFrames++; callback(time); }); });
    await page.goto(`${origin}/scenes/safehouse/index.html?gpuTier=low`);
    await page.waitForFunction(() => window.Squabblemon?.getSceneStatus?.().crewCards === 4 && !document.querySelector('#loading'), null, { timeout: 60000 });
    const send = data => page.evaluate(data => window.postMessage({ channel: 'squabblemon-scene', ...data }, location.origin), data);
    await send({ type: 'settings', reducedMotion: true }); await page.waitForTimeout(500);
    const room = await page.evaluate(() => window.Squabblemon.getSceneStatus());
    await page.screenshot({ path: `${output}/safehouse-render-${version}-day.png` });
    await send({ type: 'light', night: true }); await page.waitForTimeout(200);
    await page.screenshot({ path: `${output}/safehouse-render-${version}-night.png` });
    const reducedFrames = await page.evaluate(() => window.qaFrames); await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.qaFrames), reducedFrames, 'Reduced motion rests without a render loop');
    await send({ type: 'settings', reducedMotion: false }); await page.waitForTimeout(200);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); });
    const hiddenFrames = await page.evaluate(() => window.qaFrames); await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.qaFrames), hiddenFrames, 'Hidden state cancels render work');
    assert.equal(await page.evaluate(() => window.Squabblemon.getSceneStatus().animationPending), false);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); });
    await page.waitForTimeout(250); assert.ok(await page.evaluate(() => window.qaFrames) > hiddenFrames, 'Visible state resumes');
    assert.deepEqual(errors, []);
    report.results[version] = { drawCalls: room.drawCalls, triangles: room.triangles, batching: room.batching, reducedRest: true, simulatedHiddenRest: true, visibleResume: true, errors };
    console.log(version, JSON.stringify(report.results[version]));
    await page.close();
  }
  assert.ok(report.results.current.drawCalls <= report.results.baseline.drawCalls + 8, 'Refined props preserve the bounded draw-call budget');
  assert.ok(report.results.current.triangles <= report.results.baseline.triangles * 1.05, 'Refined prop tessellation remains below 5% triangle growth');
} finally { await browser.close(); await writeFile(`${output}/safehouse-render-budget.json`, JSON.stringify(report, null, 2)); }
