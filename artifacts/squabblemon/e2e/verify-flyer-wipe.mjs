import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:5178';
const output = process.env.KUMITE_OUTPUT ?? '/tmp/kumite-wipe-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const evidence = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 390, 844], ['landscape', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: output, size: { width, height } } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/e2e/kumite-hallway.fixture.html?reduced`);
    // Test the real overlay in isolation from backend/account data. The actual route journey
    // is covered separately by verify-kumite-hallway.mjs.
    await page.evaluate(async () => {
      window.wipeModule = await import('/src/components/kumite/FlyerWipe.tsx');
      document.body.insertAdjacentHTML('beforeend', '<section class="bt-flyer-lobby"><h1>Breakthrough transition destination</h1></section>');
    });
    const run = async (mode) => {
      await page.evaluate(mode => {
        window.handoffs = 0;
        window.coverage = null;
        window.transitionTest = window.wipeModule.startFlyerWipe(() => {
          window.handoffs++;
          const wipe = document.querySelector('.km-flyer-wipe');
          window.coverage = wipe ? getComputedStyle(wipe, '::before').opacity : null;
          if (mode === 'ready') setTimeout(() => document.dispatchEvent(new Event('kumite:entry-ready')), 100);
        }, mode === 'account-reduced');
      }, mode);
    };
    await run('ready');
    await page.locator('.km-flyer-wipe').waitFor();
    assert(await page.locator('#root').evaluate(n => n.inert));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${output}/${name}-arrive.png` });
    await page.locator('.km-flyer-wipe[data-phase=hold]').waitFor();
    await page.screenshot({ path: `${output}/${name}-covered.png` });
    await page.locator('.km-flyer-wipe').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.handoffs), 1);
    assert.equal(await page.evaluate(() => window.coverage), '1', 'route handoff is opaque');
    assert.equal(await page.locator('#root').evaluate(n => n.inert), false);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H1');
    if (name === 'desktop') {
      for (const mode of ['escape', 'os-reduced', 'hidden', 'cancel', 'missing-ready', 'account-reduced']) {
        await run(mode);
        if (mode !== 'account-reduced') await page.locator('.km-flyer-wipe').waitFor();
        if (mode === 'escape') await page.keyboard.press('Escape');
        if (mode === 'os-reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
        if (mode === 'hidden') await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        if (mode === 'cancel') await page.evaluate(() => window.transitionTest.cancelIfPending());
        await page.locator('.km-flyer-wipe').waitFor({ state: 'detached' });
        assert.equal(await page.locator('#root').evaluate(n => n.inert), false, `${mode}: input restored`);
        if (mode === 'cancel') await page.waitForTimeout(750);
        assert.equal(await page.evaluate(() => window.handoffs), mode === 'cancel' ? 0 : 1, `${mode}: exact handoff count`);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => { delete document.hidden; });
      }
    }
    assert.deepEqual(errors, []);
    evidence.push({ name, width, height, opaqueHandoff: true, inputRestored: true, focusRestored: true, errors });
    await context.close();
  }
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally { await browser.close(); }
