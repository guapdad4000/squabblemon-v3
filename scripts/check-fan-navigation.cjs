const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const [name, width, height, reducedMotion] of [
      ['desktop', 1440, 1000, 'no-preference'],
      ['phone', 390, 844, 'no-preference'],
      ['small-phone', 320, 568, 'reduce'],
      ['landscape', 844, 390, 'reduce'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
      await page.goto('http://127.0.0.1:4179/squabblemon/game', { waitUntil: 'domcontentloaded' });
      const nav = page.getByRole('navigation', { name: 'Game navigation' });
      await nav.waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.fan-nav img')].every(image => image.complete && image.naturalWidth > 0));
      assert.equal(await nav.getByRole('button').count(), width > 900 ? 8 : 5);
      assert.equal(await nav.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('.game-shell__content').evaluate(el => getComputedStyle(el).marginLeft), '0px');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
      for (const button of await nav.getByRole('button').all()) {
        const box = await button.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, `${name}: undersized target`);
        assert.ok(await button.evaluate(el => {
          const box = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(box.x + box.width / 2, box.bottom - 20));
        }), `${name}: obscured label target`);
      }
      await page.waitForTimeout(850);
      await page.screenshot({ path: `screenshots/fan-navigation-${name}.png` });
      if (width <= 900) {
        await nav.getByRole('button', { name: 'More destinations' }).click();
        const menu = page.getByRole('dialog', { name: 'Your territory' });
        await menu.waitFor();
        assert.equal(await menu.getByRole('button').count(), 5);
        await page.screenshot({ path: `screenshots/fan-navigation-menu-${name}.png` });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.fan-nav__more')?.getAttribute('aria-expanded') === 'false');
        assert.equal(await menu.isVisible(), false);
        assert.equal(await nav.getByRole('button', { name: 'More destinations' }).getAttribute('aria-expanded'), 'false');
        await nav.getByRole('button', { name: 'More destinations' }).click();
        await menu.getByRole('button', { name: /Collection/ }).click();
      } else {
        await nav.getByRole('button', { name: 'Collection', exact: true }).click();
      }
      await page.waitForURL('**/game/collection');
      if (width > 900) assert.equal(await nav.getByRole('button', { name: 'Collection', exact: true }).getAttribute('aria-current'), 'page');
      else assert.match(await nav.getByRole('button', { name: 'More destinations' }).innerText(), /Collection/i);
      if (reducedMotion === 'reduce') assert.equal(await nav.evaluate(el => el.getAnimations({ subtree: true }).length), 0);
      await nav.getByRole('button', { name: 'Safehouse', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.waitForURL('**/game');
      if (reducedMotion !== 'reduce') {
        await nav.getByRole('button', { name: 'Safehouse', exact: true }).click();
        assert.ok(await nav.evaluate(el => el.getAnimations({ subtree: true }).some(a => a.animationName === 'fan-object-pop')), 'Selected artwork should pop');
        await page.waitForTimeout(850);
        assert.equal(await nav.getByRole('button', { name: 'Safehouse', exact: true }).locator('.fan-nav__object').evaluate(el => getComputedStyle(el).transform), 'matrix(1, 0, 0, 1, 0, 0)', 'Artwork settles into place');
      }
      assert.deepEqual(errors, []);
      console.log(`${name}: assets, transparent dock, touch targets, navigation, menu, keyboard, and motion passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
