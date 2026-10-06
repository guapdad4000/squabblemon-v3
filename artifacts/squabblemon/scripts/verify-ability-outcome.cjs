const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4202';
const output = process.env.REVIEW_OUTPUT || '/tmp/ability-outcome-review';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const width of [390, 1440]) for (const mode of ['failed', 'silenced', 'shielded', 'success', 'partial']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [], media = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (/special-moves\/.*\.mp4/.test(r.url())) media.push(r.url()); });
      await page.goto(`${origin}/e2e/ability-outcome.fixture.html?mode=${mode}`);
      await page.getByTestId('battle-arena').waitFor();
      if (mode === 'success' || mode === 'partial') {
        await page.locator('.battle-special-move canvas[data-ready="true"]').waitFor({ timeout: 15000 });
        assert.ok(media.length > 0, 'successful move must still load its clip');
        assert.equal(await page.locator('.ability-failed').count(), 0);
      } else {
        assert.match(await page.getByTestId('battle-guidance').textContent(), /No effect/);
        assert.equal(await page.locator('.effect-target.beat-impact').count(), 0);
        const card = page.locator('.ability-failed');
        await card.waitFor();
        const animation = await card.evaluate(n => {
          const style = getComputedStyle(n);
          const animation = n.getAnimations().find(a => a.animationName === 'ability-failed-shake');
          if (animation) { animation.pause(); animation.currentTime = 80; }
          return { name: style.animationName, duration: style.animationDuration, width: n.getBoundingClientRect().width };
        });
        assert.equal(animation.name, 'ability-failed-shake');
        assert.equal(animation.duration, '0.26s');
        assert.ok(animation.width > 0);
        assert.equal(await page.locator('.battle-choreography, .battle-special-move, video').count(), 0);
        await page.waitForTimeout(350);
        assert.equal(media.length, 0, 'failed moves must never request special media');
        for (const theme of ['light', 'dark']) {
          await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
          await page.screenshot({ path: `${output}/${width}-${mode}-${theme}.png` });
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await card.evaluate(n => getComputedStyle(n).animationName), 'none');
      }
      assert.deepEqual(errors, []);
      results.push({ width, mode, mediaRequests: media.length, errors });
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${output}/browser.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
