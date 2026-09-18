const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', error => errors.push(error.message));
      for (const [mode, material] of [['freeze', 'ice-shell'], ['burn', 'burn'], ['silence', 'chains'], ['thaw', 'charge']]) {
        await page.goto(`http://127.0.0.1:4179/squabblemon/e2e/choreography.fixture.html?mode=${mode}`);
        await page.getByTestId('character-attack').waitFor();
        if (mode !== 'thaw') assert.equal(await page.locator(`[data-battle-fx="${material}"]`).count(), 0);
        await page.evaluate(() => window.battleFixture.impact());
        await page.locator(`[data-battle-fx="${material}"]`).first().waitFor({ state: 'attached' });
        if (mode === 'freeze') {
          assert.equal(await page.locator('[data-battle-fx="burn"]').count(), 0, 'Freeze must not masquerade as damage');
          await page.locator('[data-battle-fx="district-snap"]').waitFor();
        }
        if (mode === 'thaw') assert.equal(await page.locator('[data-battle-fx="ice-shell"]').count(), 0);
        await page.waitForTimeout(140);
        await page.screenshot({ path: `screenshots/battle-material-${mode}-${name}.png` });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.evaluate(() => window.battleFixture.ready());
        if (mode === 'freeze' || mode === 'silence') assert.ok(await page.locator(`[data-battle-fx="${material}"]`).count(), 'Persistent material survives the impact');
        await page.evaluate(() => window.battleFixture.energy());
        await page.locator('[data-testid="motion-player"] [data-battle-fx="charge"]').waitFor();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('[data-testid="motion-player"] [data-battle-fx="charge"]').evaluate(node => getComputedStyle(node).display), 'none');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => document.querySelector('[data-testid="battle-arena"]').dataset.reducedMotion = 'true');
        assert.equal(await page.locator('[data-testid="motion-player"] [data-battle-fx="charge"]').evaluate(node => getComputedStyle(node).display), 'none');
        await page.locator('.motion-energy-gain').waitFor({ state: 'detached' });
        assert.equal(await page.locator('[data-battle-fx="district-snap"]').count(), 0, 'Temporary territory effects clean up');
      }
      await page.close();
      console.log(`${name}: freeze, burn, chains, cleanse, takeover, energy and reduced motion passed`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
