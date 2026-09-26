import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(`${process.env.UI_ORIGIN ?? 'http://localhost:4207'}/e2e/season-one-readthrough.fixture.html`);
await page.waitForFunction(() => window.__reviewEntries?.length === 626);
await page.evaluate(() => document.fonts.ready);
let checked = 0;
for (const viewport of [{width:375,height:667},{width:390,height:844},{width:1440,height:900}]) {
  await page.setViewportSize(viewport);
  // Longest line in each section exercises every scene, portrait set and layout.
  const indices = await page.evaluate(() => {
    const longest = new Map();
    window.__reviewEntries.forEach((entry, index) => {
      const prior = longest.get(entry.label);
      if (prior === undefined || entry.line.text.length > window.__reviewEntries[prior].line.text.length) longest.set(entry.label, index);
    });
    return [...longest.values()];
  });
  for (const index of indices) {
    await page.evaluate(index => window.__reviewSelect(index), index);
    const expected = await page.evaluate(index => window.__reviewEntries[index].line.text, index);
    await page.waitForFunction(text => document.querySelector('.story-stage__line')?.textContent === text, expected);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.evaluate(() => {
      const line = document.querySelector('.story-stage__line');
      const button = document.querySelector('.story-stage__next');
      const a = line.getBoundingClientRect(), b = button.getBoundingClientRect();
      return { fits: a.left >= 0 && a.right <= innerWidth && a.top >= 0 && a.bottom <= b.top && b.bottom <= innerHeight && line.scrollHeight <= line.clientHeight + 1, text: line.textContent };
    });
    assert.ok(result.fits, `${viewport.width}: ${result.text}`);
    checked++;
  }
  await page.screenshot({path: `/tmp/season-one-${viewport.width}.png`});
}
assert.deepEqual(errors, []);
await page.locator('select').selectOption('0');
await page.locator('.story-stage__next').click();
await page.waitForFunction(() => document.querySelector('.story-stage__line')?.textContent === window.__reviewEntries[1].line.text);
console.log(`${checked} scene/viewport checks passed; navigation passed; no page errors.`);
await browser.close();
