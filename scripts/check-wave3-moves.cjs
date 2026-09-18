const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = 'http://localhost:4179/squabblemon/';
const batch = process.argv.includes('--wave4') ? 'wave4' : 'wave3';
const wave = batch === 'wave4'
  ? { shiesty: 'char64', torta: 'char65', waterboy: 'char66', buspass: 'char67', cognac: 'char68', bustdown: 'char69', soulfood: 'char70' }
  : { nguyen: 'char55', manman: 'char56', pinaynurse: 'char57', honestthot: 'char58', earthy: 'char59', abuela: 'char60', icecream: 'char61', scammer: 'char62', vibe: 'char63' };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const create = document.createElement.bind(document);
        document.createElement = function(tag, ...rest) {
          const el = create(tag, ...rest);
          if (tag === 'video') window.moveVideo = el;
          return el;
        };
      });
      await page.goto(origin + `moves?card=${Object.keys(wave)[0]}`, { waitUntil: 'domcontentloaded' });
      for (const [cardId, clipId] of Object.entries(wave)) {
        await page.getByLabel('Card', { exact: true }).selectOption(cardId);
        assert.equal(await page.getByLabel('Animation', { exact: true }).inputValue(), clipId);
        await page.locator('canvas[data-ready="true"]').waitFor();
        await page.waitForFunction(id => window.moveVideo?.src.includes(`${id}_chroma.mp4`) && !window.moveVideo.paused && window.moveVideo.currentTime >= 1, clipId);
        assert.ok(await page.evaluate(() => window.moveVideo.muted));
      }
      await page.getByRole('button', { name: 'Play with sound', exact: true }).click();
      await page.waitForFunction(() => window.moveVideo && !window.moveVideo.muted && !window.moveVideo.paused);
      await page.getByRole('button', { name: 'Mute preview', exact: true }).click();
      await page.waitForFunction(() => window.moveVideo.muted);
      for (const [cardId, clipId] of Object.entries(wave)) {
        await page.goto(origin + `e2e/wave3-moves.fixture.html?card=${cardId}`, { waitUntil: 'domcontentloaded' });
        await page.locator(`[data-move-id="${clipId}"] canvas[data-ready="true"]`).waitFor();
        await page.waitForFunction(() => window.moveVideo?.currentTime >= 1.5);
        const alpha = await page.locator('.battle-special-move canvas').evaluate(canvas => {
          const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let transparent = 0, solid = 0;
          for (let i = 3; i < data.length; i += 4) { if (data[i] === 0) transparent++; if (data[i] === 255) solid++; }
          return { transparent, solid };
        });
        assert.ok(alpha.transparent > 100 && alpha.solid > 100, `${name}: ${clipId} ${JSON.stringify(alpha)}`);
        if (cardId === 'abuela' || cardId === 'waterboy' || cardId === 'bustdown') {
          await page.screenshot({ path: `screenshots/${batch}-battle-${cardId}-${name}.png` });
        }
        await page.evaluate(() => window.wave3Fixture.impact());
        assert.equal(await page.getByTestId('character-attack').getAttribute('data-impact'), 'true');
        await page.evaluate(() => window.wave3Fixture.ready());
        assert.equal(await page.locator('[data-move-id]').count(), 0);
        assert.ok(await page.evaluate(() => window.moveVideo.paused && !window.moveVideo.hasAttribute('src')));
      }
      assert.deepEqual(errors, []);
      console.log(`${batch} ${name}: ${Object.keys(wave).length} correct workshop assignments, native sound/mute, keyed battle videos, impacts and cleanup passed.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
