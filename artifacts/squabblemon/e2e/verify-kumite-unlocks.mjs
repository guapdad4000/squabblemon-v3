import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base = process.env.KUMITE_FILMS_ORIGIN ?? 'http://127.0.0.1:4207';
const browser = await chromium.launch();
const receipt = { id: 'kumite:card:p-tang:v1', cardId: 'p-tang', name: 'P. Tang' };
try {
  for (const mode of ['normal', 'reduced', 'failed-video', 'battle', 'navigation-race', 'signout-race', 'claim-failure']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); const errors = []; let claims = 0, claimed = false, release;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/kumite/film-receipts', route => route.fulfill({ json: { receipts: claimed ? [] : [receipt] } }));
    await page.route('**/api/kumite/film-receipts/claim', async route => {
      claims++;
      if (mode.endsWith('-race')) await new Promise(resolve => { release = resolve; });
      if (mode === 'claim-failure') return route.fulfill({ status: 503, json: { error: 'Temporary fixture failure' } });
      const next = claimed ? null : receipt; claimed = true;
      await route.fulfill({ json: { receipt: next } });
    });
    if (mode === 'failed-video') await page.route('**/films/v1/*.mp4', route => route.abort());
    await page.goto(`${base}/e2e/kumite-unlocks.fixture.html${mode === 'battle' ? '?battle' : ''}`);
    if (mode === 'battle') {
      await page.waitForTimeout(700); assert.equal(claims, 0);
      await page.getByRole('button', { name: 'Return to Safehouse' }).click();
    }
    if (mode.endsWith('-race')) {
      for (let i = 0; i < 100 && !release; i++) await page.waitForTimeout(50);
      assert.ok(release);
      await page.getByRole('button', { name: mode === 'signout-race' ? 'Sign out' : 'Start battle', exact: true }).click();
      release(); await page.waitForTimeout(300);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      if (mode === 'signout-race') { assert.equal(claims, 1); await context.close(); console.log(`${mode} passed`); continue; }
      await page.getByRole('button', { name: 'Return to Safehouse' }).click();
    }
    if (mode === 'claim-failure') {
      await page.waitForTimeout(1200); assert.equal(claims, 1, 'No tight retry loop');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await context.close(); console.log(`${mode} passed`); continue;
    }
    if (!['reduced', 'failed-video'].includes(mode)) {
      await page.locator('dialog.kumite-film[open]').waitFor();
      await page.getByRole('button', { name: 'Skip / close', exact: true }).click();
    }
    await page.getByRole('dialog', { name: 'P. Tang unlocked', exact: true }).waitFor();
    assert.equal(await page.locator('dialog.kumite-film').count(), 0);
    assert.equal(claims, 1, 'StrictMode makes one claim');
    await page.getByRole('button', { name: 'Keep going' }).click();
    assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.getByRole('button', { name: 'Refresh receipts' }).click();
    await page.reload(); await page.waitForTimeout(500);
    assert.equal(await page.locator('dialog[open]').count(), 0, 'Reload does not replay acknowledged film');
    assert.deepEqual(errors, []); await context.close(); console.log(`${mode} passed`);
  }
} finally { await browser.close(); }
