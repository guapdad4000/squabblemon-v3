const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const [name, width, height, reducedMotion] of [
      ['desktop', 1440, 1000, 'no-preference'],
      ['phone', 390, 844, 'reduce'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:4179/squabblemon/');
      await page.locator('.animated-logo').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.animated-logo img')].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('.animated-logo img').count(), 4);
      assert.ok(await page.getByRole('link', { name: 'Sign In', exact: true }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.waitForTimeout(1600);
      if (reducedMotion === 'reduce') {
        assert.equal(await page.locator('.animated-logo__toggle').isVisible(), false);
        assert.equal(await page.locator('.animated-logo').evaluate(el => el.getAnimations({ subtree: true }).length), 0);
      } else {
        await page.getByRole('button', { name: 'Pause logo animation' }).click();
        assert.ok(await page.locator('.animated-logo').evaluate(el => el.getAnimations({ subtree: true }).every(a => a.playState === 'paused')));
        await page.getByRole('button', { name: 'Play logo animation' }).click();
        assert.ok(await page.locator('.animated-logo').evaluate(el => el.getAnimations({ subtree: true }).some(a => a.playState === 'running')));
      }
      await page.screenshot({ path: `screenshots/animated-logo-${name}.png`, fullPage: true });
      await page.getByRole('link', { name: 'Sign In', exact: true }).click();
      await page.waitForURL('**/sign-in');
      assert.deepEqual(errors, []);
      console.log(`${name}: four assets, sign-in navigation, layout, motion preference, and pause/resume passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
