const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const [name, width, height, motion] of [
      ['desktop', 1440, 1000, 'no-preference'],
      ['phone', 390, 844, 'reduce'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: motion });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (/THREE.*Error|VALIDATE_STATUS|Shader Error/.test(message.text())) errors.push(message.text()); });
      await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
      await page.goto('http://127.0.0.1:4179/squabblemon/game/collection');
      const grid = page.getByTestId('collection-card-grid');
      await grid.waitFor();
      assert.equal(await page.locator('.collector-tier-option').count(), 5);
      assert.equal(await grid.locator('canvas').count(), 0, 'Grids must not allocate WebGL contexts');
      await page.waitForFunction(() => [...document.querySelectorAll('.collector-wallpaper')].every(img => img.complete && img.naturalWidth > 0));
      const control = page.getByTestId('collection-card-control').filter({ has: page.locator('[data-card-rarity="Epic"]') }).first();
      await control.click();
      const card = page.getByTestId('card-inspector');
      await card.waitFor();
      const cardBounds = await card.boundingBox();
      assert.ok(cardBounds.y >= 0, 'Inspector artwork must not be clipped above the viewport');
      if (motion === 'no-preference') {
        await card.locator('canvas').waitFor();
        const box = await card.boundingBox();
        await page.mouse.move(box.x + box.width * .8, box.y + box.height * .3);
        assert.notEqual(await card.evaluate(el => el.style.getPropertyValue('--tilt-y')), '');
      } else {
        assert.equal(await card.locator('canvas').count(), 0);
      }
      await page.screenshot({ path: `screenshots/card-finish-${name}.png` });
      await page.getByTestId('button-close-inspector').click();
      assert.equal(await page.locator('.collector-webgl canvas').count(), 0);
      await page.getByRole('button', { name: /Legendary Gold spectral/i }).click();
      assert.equal(await grid.locator('[data-card-rarity]:not([data-card-rarity="Legendary"])').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`${name}: backgrounds, five tiers, filtering, inspector, motion policy, and WebGL lifecycle passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
