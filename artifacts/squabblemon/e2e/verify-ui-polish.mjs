import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4197';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.goto(origin + '/game/shop?view=corner');
  await page.getByRole('button', { name: 'Fade Market', exact: true }).click();
  await page.getByText('Preview mode · Checkout and resume are disabled.').waitFor();
  await page.getByRole('button', { name: 'Packs', exact: true }).click();
  await page.getByText('SHOWCASE PACK · PREVIEW').first().waitFor();
  await page.getByRole('button', { name: 'View', exact: true }).first().click();
  const preview = page.getByRole('dialog');
  await preview.getByText('Showcase preview only. This item is not currently for sale.').waitFor();
  assert.equal(await preview.getByRole('button', { name: /checkout|purchase|buy/i }).count(), 0);
  await page.reload();
  await page.getByRole('button', { name: 'Fade Market', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('squabblemon:corner-demo:v1:e2e-player')), null);
  assert.match(await page.locator('.city-header__balance').innerText(), /0/);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
  }
  await page.locator('.layered-venue__cutout').first().waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.layered-venue__light').first().evaluate(e => getComputedStyle(e).animationName), 'none');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['win', 'loss', 'versus']) {
    await page.goto(origin + '/e2e/ui-polish.fixture.html?mode=' + mode);
    const button = page.getByRole('button', { name: mode === 'versus' ? 'Step into the field' : 'Continue the fade' });
    const bounds = await button.boundingBox();
    assert.ok(bounds && bounds.y + bounds.height < 844, `${mode} action must be above the fold`);
    await button.click();
    assert.ok(await page.evaluate(() => document.body.dataset.action));
    if (mode === 'loss') {
      await page.getByRole('button', { name: 'Regroup', exact: true }).click();
      assert.equal(await page.evaluate(() => document.body.dataset.action), 'regroup');
    }
  }
  assert.deepEqual(errors, []);
  console.log('UI flows passed: payment preview isolation, responsive layout, reduced motion, result actions, versus entry.');
} finally {
  await browser.close();
}
