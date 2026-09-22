import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const browser = await chromium.launch();
try {
  for (const [width, height] of [[320, 740], [390, 844], [471, 956], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/e2e/park.fixture.html`);
    const header = page.getByRole('banner', { name: 'Player and navigation' });
    const music = header.locator(':scope > button[aria-label="Music controls"]');
    const express = header.locator(':scope > button[aria-label="Open game navigation"]');
    await express.waitFor();
    await page.getByTestId('find-ranked-fade').waitFor();
    assert.equal(await page.getByTestId('find-ranked-fade').isEnabled(), true);
    assert.equal(await page.getByRole('alert').count(), 0, 'Fixture must show the actual lobby, not a network-error state');
    const mb = await music.boundingBox(), eb = await express.boundingBox(), hb = await header.boundingBox();
    assert.ok(mb && eb && hb);
    assert.ok(mb.x + mb.width <= eb.x + 1, 'Music is beside Express, not floating');
    assert.ok(mb.y >= hb.y && mb.y + mb.height <= hb.y + hb.height, 'Music stays in navigation');
    assert.ok(mb.width >= 44 && mb.height >= 44, 'Music retains accessible touch target');
    assert.equal(await page.locator('.park-dj').count(), 0, 'No floating music widget obscures Find a fade');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await music.click();
    const panel = page.getByRole('dialog', { name: 'The Fade Tapes' });
    await panel.waitFor();
    const bounds = await panel.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1);
    assert.ok(await panel.getByRole('combobox', { name: 'Choose music track' }).locator('option').count() >= 6);
    await panel.getByRole('button', { name: 'Close music controls' }).click();
    assert.equal(await panel.isVisible(), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `screenshots/header-music-${width}.png` });
    console.log(`PASS ${width}x${height}: header placement, touch targets, dialog, no floating art`);
    await page.close();
  }
} finally {
  await browser.close();
}