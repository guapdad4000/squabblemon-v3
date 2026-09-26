import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const output = process.env.REVIEW_DIR ?? '../deliverables/result-fullscreen-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome' });
const checks = [];
const fits = (box, width, height) => box && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
try {
  for (const [name, width, height] of [
    ['small-phone', 320, 568], ['phone', 390, 844], ['large-phone', 430, 932],
    ['ipad', 768, 1024], ['ipad-landscape', 1024, 768], ['desktop', 1440, 900],
    ['ultrawide', 2560, 1080], ['phone-landscape', 844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const states = name === 'phone' || name === 'desktop'
      ? ['story', 'story-loss', 'win', 'loss', 'draw', 'story-draw', 'pending', 'error', 'guest']
      : ['story', 'story-loss'];
    for (const state of states) {
      await page.goto(`${origin}/e2e/result-stage.fixture.html?state=${state}`);
      await page.locator('.result-art__plaque').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const stage = page.locator('.result-art');
      const art = await page.locator('.result-art__canvas').boundingBox();
      assert.deepEqual(art, { x: 0, y: 0, width, height }, 'Artwork must fill the viewport without borders');
      assert.equal(await page.locator('.result-stage').evaluate(el => el.scrollHeight > el.clientHeight + 1), false, 'Results should fit without initial scrolling');
      const plaque = await page.locator('.result-art__plaque').boundingBox();
      const scores = await page.locator('.result-art__scores').boundingBox();
      assert.ok(fits(plaque, width, height) && fits(scores, width, height), 'Paper panels fit the screen');
      const primary = page.locator('.result-art__actions .studio-action').first();
      const cta = await primary.boundingBox();
      assert.ok(cta.y >= plaque.y + plaque.height && cta.y >= scores.y + scores.height, 'Actions stay below rewards and scores');
      for (const button of await page.locator('.result-art__actions button, .result-art__toggle, .result-stage__receipt-drawer > summary').all()) {
        const box = await button.boundingBox();
        assert.ok(fits(box, width, height), 'Every result control stays on the artwork');
        assert.ok(box.height >= 44, 'Controls have a 44px touch target');
        await button.click({ trial: true });
      }
      const mark = page.locator('.result-art__outcome-mark, .result-art__draw-mark');
      const markBox = await mark.boundingBox();
      assert.ok(markBox.y + markBox.height <= plaque.y + 1, 'Outcome mark stays above the receipt');
      if (state.startsWith('story')) {
        const stars = await page.locator('.result-art__story-stars').boundingBox();
        assert.ok(markBox.y >= stars.y + stars.height - 1, 'W/L/Tie must sit below the stars');
        assert.ok(Math.abs(markBox.x + markBox.width / 2 - stars.x - stars.width / 2) < 1, 'Stars and outcome are centered together');
      }
      if (state === 'story' || state === 'story-loss') {
        await page.screenshot({ path: `${output}/${name}-${state}.png` });
      }
      const details = page.locator('.result-stage__receipt-drawer > summary');
      await details.click();
      assert.ok(fits(await page.locator('.result-stage__receipt').boundingBox(), width, height), 'Expanded details remain readable inside the viewport');
      if (state === 'error') {
        await page.getByRole('button', { name: 'Retry Save' }).click();
        await page.getByText('Battle earnings', { exact: true }).waitFor();
      }
      await details.click();
      if (!state.includes('draw')) {
        await page.getByRole('button', { name: 'View scene' }).click();
        assert.equal(await page.locator('.result-art__plaque').count(), 0);
        assert.ok(fits(await primary.boundingBox(), width, height), 'Exit stays available in scene view');
        await page.getByRole('button', { name: 'Show results' }).click();
      }
      await page.getByTestId('button-inspect-final-board').click();
      assert.equal(await stage.count(), 0, 'Final-board inspection opens');
      await page.getByRole('button', { name: 'View result', exact: true }).click();
      await page.locator('.result-art__plaque').waitFor();
      await primary.click();
      assert.ok(await page.evaluate(() => document.body.dataset.action), 'Result action reaches its destination');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      checks.push({ name, width, height, state, passed: true });
      console.log(`PASS ${name} ${state}: full-screen art, stars/mark, touch targets, details, scene and navigation`);
    }
    await page.close();
  }
  await writeFile(`${output}/verification.json`, JSON.stringify(checks, null, 2));
} finally {
  await browser.close();
}
