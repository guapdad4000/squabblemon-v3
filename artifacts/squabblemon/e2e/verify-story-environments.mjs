import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const origin = process.env.STORY_ENVIRONMENT_ORIGIN || 'http://127.0.0.1:4198';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  for (const [width, height, node, expected] of [
    [1440, 900, 'sherlock-thirteenth-bell-clocks', '04-impossible-midnight-station'],
    [768, 1024, 'oz-behind-the-curtain-receipts', '14-emerald-customer-service-hall'],
    [390, 844, 'alice-borrowed-hour-sizes', '19-hallway-of-wrong-sized-doors'],
    [375, 667, 'homeless-a-place-to-return-appointments', '31-housing-appointment-office'],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/e2e/season-theater.fixture.html?scenario=puzzle-dialogue&puzzleNode=${node}`, { waitUntil: 'networkidle' });
    const stage = page.locator('.story-stage');
    await stage.waitFor();
    assert.match(await page.locator('.story-stage__world').evaluate(el => getComputedStyle(el).backgroundImage), new RegExp(expected));
    const bounds = await stage.boundingBox();
    assert(bounds.height >= height - 100 && bounds.y + bounds.height <= height + 1, 'Scene must fill remaining viewport');
    const next = page.locator('.story-stage__next');
    await next.waitFor();
    assert(await next.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'Dialogue action must remain reachable');
    if (width <= 640) assert.equal(await page.locator('.story-environment-prop').isVisible(), false);
    else {
      assert.equal(await page.locator('.story-environment-prop').evaluate(el => getComputedStyle(el).animationName), 'none');
      assert(await page.locator('.story-environment-prop').evaluate(el => el.complete && el.naturalWidth > 0));
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${width}x${height}: ${expected}`);
  }
} finally { await browser.close(); }
