const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844], ['landscape', 844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.url().includes('/assets/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto('http://127.0.0.1:4179/squabblemon/play/guest');
      await page.getByTestId('button-start').waitFor();
      await page.locator('[data-testid^="deck-"] img').evaluateAll(xs => Promise.all(xs.map(x => x.decode().catch(() => {}))));
      if (name === 'desktop') await page.screenshot({ path: 'screenshots/layered-art-crew.png' });
      await page.getByTestId('button-start').click();
      await page.getByRole('button', { name: /^Continue past / }).click({ force: true });
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-arena"]')?.getAttribute('data-presentation-phase') === 'player-ready');
      await page.locator('[data-card-zone] img').evaluateAll(xs => Promise.all(xs.map(x => x.decode())));
      await page.screenshot({ path: `screenshots/layered-art-${name}.png` });
      const geometry = await page.getByTestId('button-next-round').boundingBox();
      assert(geometry.y + geometry.height <= height && geometry.x + geometry.width <= width, `${name}: action clipped`);
      assert(await page.locator('.collector-art-rim').count() > 0);
      assert(await page.locator('.battle-venue__art').evaluate(x => x.style.backgroundImage.includes('/layered/')));
      await page.getByTestId('hand-tray').locator('[data-card-zone="hand"]:not([title])').first().click();
      await page.getByRole('button', { name: /^Deploy / }).first().click();
      await page.getByTestId('button-lock').click();
      await page.locator('.attack-caption__scene').first().waitFor({ timeout: 20000 });
      await page.screenshot({ path: `screenshots/layered-art-${name}-ability.png` });
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-arena"]')?.getAttribute('data-presentation-phase') === 'player-ready', {}, { timeout: 20000 }).catch(async error => {
        console.log(name, 'last phase', await page.getByTestId('battle-arena').getAttribute('data-presentation-phase'), errors);
        throw error;
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.battle-venue__atmosphere').evaluate(x => getComputedStyle(x, '::after').animationName), 'none');
      assert.deepEqual(errors, [], `${name}: browser/asset errors`);
      console.log(`${name}: artwork loaded, controls fit, ability layers rendered, turn completed, reduced motion respected; no browser errors.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
