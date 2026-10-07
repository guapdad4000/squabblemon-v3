import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { installFadecadeApi } from './fadecade.fixture.ts';
import { assertSpriteArt } from './motion-sprite-proof.ts';
const base = process.env.ARCADE_BASE_URL ?? process.env.UI_ORIGIN ?? 'http://127.0.0.1:4198';
const out = process.env.REVIEW_OUTPUT ?? '../../screenshots/minigame-motion';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.routeWebSocket('**', () => {});
    const api = await installFadecadeApi(page, { activeRun: true });
    await page.goto(`${base}/game/challenges`);
    await page.getByRole('button', { name: 'Continue road', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))));
    const road = page.locator('.fadecade-road-view:not(.is-compact)');
    await road.locator('.fadecade-sprite--walk').waitFor();
    assert.match(await road.locator('.fadecade-sprite').evaluate(el => getComputedStyle(el).animationName), /run-frames/);
    const idle = road.locator('[data-sprite="road-idle"]');
    await idle.waitFor();
    await idle.scrollIntoViewIfNeeded();
    await assertSpriteArt(page, '.fadecade-road-view:not(.is-compact) .motion-sprite');
    const poses = new Set();
    for (let n = 0; n < 8; n++) {
      poses.add(await idle.locator('image').evaluate(el => getComputedStyle(el).transform));
      await page.waitForTimeout(180);
    }
    assert.ok(poses.size >= 3, 'Road idle plays distinct frames');
    await page.screenshot({ path: `${out}/road-idle-${name}.png` });
    await page.getByRole('button', { name: 'End run', exact: true }).click();
    await page.getByRole('button', { name: 'End run now', exact: true }).click();
    const defeat = road.locator('[data-sprite="road-defeat"]');
    await defeat.waitFor();
    await assertSpriteArt(page, '.fadecade-road-view:not(.is-compact) .motion-sprite');
    assert.equal(await defeat.locator('image').evaluate(el => getComputedStyle(el).animationIterationCount), '1');
    assert.equal(api.requests.abandons, 1);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/road-defeat-${name}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await defeat.locator('image').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.deepEqual(errors, []);
    console.log(`PASS ${name}: walking, articulated idle, defeat, reduced motion and one run-abandon receipt`);
    await page.close();
  }
} finally { await browser.close(); }
