import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[390, 844], [730, 990], [1440, 900], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const state of ['story', 'loss']) {
      await page.goto(`${origin}/e2e/result-stage.fixture.html?state=${state}`);
      await page.locator('.result-art__image').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const portrait = width <= height || width <= 639;
      assert.equal(await page.locator('.result-art__image').evaluate(el => el.currentSrc.includes('-portrait')), portrait);
      const primary = page.locator('.result-art__actions .studio-action').first();
      await primary.waitFor();
      const cta = await primary.boundingBox();
      const plaque = await page.locator('.result-art__plaque').boundingBox();
      const scores = await page.locator('.result-art__scores').boundingBox();
      assert.ok(cta.y >= plaque.y + plaque.height, 'CTA must be below earnings');
      assert.ok(cta.y >= scores.y + scores.height, 'CTA must be below district scores');
      if (state === 'story') assert.ok(cta.y + cta.height <= height, 'Primary action should fit in initial viewport');
      await primary.click({ trial: true });
      await page.locator('.result-stage__receipt-drawer > summary').click();
      await page.locator('.result-stage__receipt').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await primary.scrollIntoViewIfNeeded();
      await primary.click({ trial: true });
      assert.deepEqual(errors, []);
      console.log(`PASS ${state} ${width}x${height}: correct art, clear CTA, expandable details`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}