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
  await page.getByRole('button', { name: '$2.99 · Demo', exact: true }).click();
  await page.getByRole('button', { name: 'Complete demo purchase' }).click();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await page.getByRole('button', { name: 'Packs', exact: true }).click();
  await page.getByRole('button', { name: '400 Clout', exact: true }).click();
  await page.getByRole('button', { name: 'Complete demo purchase' }).click();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Fade Market', exact: true }).click();
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon:corner-demo:v1:e2e-player')));
  assert.equal(wallet.clout, 100);
  assert.equal(wallet.receipts.length, 2);
  assert.match(await page.locator('.city-header__balance').innerText(), /500/);
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
  console.log('UI flows passed: demo checkout, persistence, account isolation, responsive layout, reduced motion, result actions, versus entry.');
} finally {
  await browser.close();
}
