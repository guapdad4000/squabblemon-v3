import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const browser = await chromium.launch();
const sizes = [[320, 568], [390, 844], [519, 900], [844, 390], [1440, 900]];
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const goto = async path => {
      await page.goto(origin + path);
      await page.locator('#root').waitFor({ state: 'attached' });
      await page.evaluate(() => document.fonts.ready);
    };
    const noOverflow = async () => assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Horizontal page overflow at ${width}x${height}`,
    );
    await goto('/e2e/ui-polish.fixture.html?mode=story-node');
    const start = page.locator('.story-briefing__btn--start');
    await start.waitFor();
    await page.locator('.story-briefing').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(150);
    assert.ok(await start.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom + 20 <= innerHeight &&
        el.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    }), `Story action clipped or occluded at ${width}x${height}`);
    const focus = page.locator('.story-briefing__focus-card').first();
    assert.ok(await focus.count(), 'The fixture must include actual focus cards');
    assert.equal(await focus.evaluate(el => getComputedStyle(el).getPropertyValue('--rarity-pattern').trim()), 'none');
    assert.ok(await focus.evaluate(el => {
      const glow = el.querySelector('.card-rarity-glow').getBoundingClientRect();
      const card = el.getBoundingClientRect();
      return glow.width <= card.width + 1 && glow.height <= card.height + 1;
    }), 'Rarity decoration must remain inside its own card');
    await noOverflow();
    if (width === 390) await page.screenshot({ path: '/tmp/story-briefing-bottom.jpg' });
    await start.click();
    assert.equal(await page.evaluate(() => document.body.dataset.action), 'start');

    await goto('/e2e/result-stage.fixture.html?state=story');
    const action = page.locator('.result-stage__actions .studio-action').first();
    await action.waitFor();
    assert.equal(await page.locator('.result-stage__actions').evaluate(el => getComputedStyle(el).display), 'flex');
    assert.ok(await action.evaluate(el => el.getBoundingClientRect().width <= 320), 'Result CTA must not stretch');
    await action.scrollIntoViewIfNeeded();
    await action.click({ trial: true });
    await noOverflow();
    if (width === 390) await page.screenshot({ path: '/tmp/result-compact-action.jpg' });

    await goto('/e2e/ui-polish.fixture.html?mode=music');
    await page.locator('.music-trigger').click();
    await page.locator('.music-dialog').waitFor();
    assert.ok(await page.locator('.music-dialog').evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.left >= -1 && r.right <= innerWidth + 1 && r.height <= innerHeight;
    }), 'Music dialog must fit viewport');
    await noOverflow();
    if (width === 390) await page.screenshot({ path: '/tmp/dr-fade-music.jpg' });

    await page.route('**/api/multiplayer/ranked', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ room: null }),
    }));
    await goto('/e2e/park.fixture.html');
    await page.locator('.deck-carousel__jump select').waitFor();
    await noOverflow();
    await page.locator('.park-find').scrollIntoViewIfNeeded();
    await page.locator('.park-find').click({ trial: true, timeout: 5000 });
    assert.ok(await page.locator('.deck-carousel').evaluate(el => {
      const r = el.getBoundingClientRect();
      const board = el.closest('.park-board-wrapper').getBoundingClientRect();
      return r.left >= board.left - 1 && r.right <= board.right + 1;
    }), 'Deck selector must fit the ranked board');
    assert.deepEqual(errors, [], `Browser errors at ${width}x${height}`);
    console.log(`PASS: Story action, focus art, result CTA, music bounds, Fade Park at ${width}x${height}`);
    await page.close();
  }
} finally {
  await browser.close();
}