const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4179/squabblemon/';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + 'e2e/special-moves.fixture.html');
      await page.getByRole('heading', { name: 'Special move workshop' }).waitFor();
      await page.locator('canvas[data-ready="true"]').waitFor();
      const alpha = await page.locator('canvas').evaluate(canvas => {
        const data = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let transparent = 0, solid = 0;
        for (let i=3;i<data.length;i+=4) { if(data[i]===0) transparent++; if(data[i]===255) solid++; }
        return { transparent, solid };
      });
      assert.ok(alpha.transparent > 1000 && alpha.solid > 1000, JSON.stringify(alpha));
      await page.screenshot({ path: `screenshots/special-moves-${name}.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByLabel('Animation', { exact: true }).selectOption('char08');
      await page.getByRole('button', { name: 'Use for this card' }).click();
      await page.reload();
      assert.equal(await page.getByLabel('Animation', { exact: true }).inputValue(), 'char08');
      await page.getByLabel('Animation', { exact: true }).selectOption('');
      await page.getByRole('button', { name: 'Use for this card' }).click();
      await page.reload();
      assert.equal(await page.locator('canvas').count(), 0);
      await page.getByRole('button', { name: 'Restore defaults' }).click();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Replay preview' }).click();
      assert.equal(await page.locator('canvas').getAttribute('data-ready'), 'false');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.route('**/assets/special-moves/**', route => route.abort());
      await page.getByRole('button', { name: 'Replay preview' }).click();
      await page.getByRole('status').filter({ hasText: 'Clip unavailable' }).waitFor();
      assert.equal(await page.locator('canvas').getAttribute('data-ready'), 'false');
      await page.unroute('**/assets/special-moves/**');
      await page.goto(origin + 'e2e/choreography.fixture.html', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-move-id="char36"] canvas[data-ready="true"]').waitFor();
      await page.evaluate(() => window.battleFixture.impact());
      await page.getByTestId('battle-power-change').filter({ hasText: 'Frozen' }).waitFor();
      await page.evaluate(() => window.battleFixture.ready());
      assert.equal(await page.locator('[data-move-id]').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`${name}: chroma playback, persistent swaps, disable, reduced motion, failed media, battle impact and cleanup passed`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
