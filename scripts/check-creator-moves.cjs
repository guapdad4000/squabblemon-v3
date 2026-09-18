const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const origin = 'http://localhost:4179/squabblemon/';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const report = [];
  try {
    for (const [size, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        window.creatorVideos = [];
        const create = document.createElement.bind(document);
        document.createElement = function(tag, ...args) { const el = create(tag, ...args); if (tag === 'video') window.creatorVideos.push(el); return el; };
      });
      for (const [card, clip] of [['simmy', 'char93'], ['foodz', 'char92']]) {
        await page.goto(origin + 'moves?card=' + card, { waitUntil: 'domcontentloaded' });
        assert.equal(await page.getByLabel('Animation', { exact: true }).inputValue(), clip);
        await page.locator('canvas[data-ready="true"]').waitFor();
        await page.getByRole('button', { name: 'Play with sound', exact: true }).click();
        await page.waitForFunction(clip => window.creatorVideos.some(v => v.src.includes(clip + '_chroma.mp4') && !v.muted && v.currentTime >= 3), clip);
        const media = await page.evaluate(clip => {
          const v = window.creatorVideos.findLast(v => v.src.includes(clip + '_chroma.mp4'));
          return { duration: v.duration, width: v.videoWidth, height: v.videoHeight, audioBytes: v.webkitAudioDecodedByteCount, muted: v.muted };
        }, clip);
        assert(media.audioBytes > 0, 'native audio is decoded');
        await page.getByRole('button', { name: 'Mute preview', exact: true }).click();
        assert(await page.evaluate(clip => window.creatorVideos.filter(v => v.src.includes(clip + '_chroma.mp4')).every(v => v.muted), clip));
        await page.goto(origin + 'e2e/wave3-moves.fixture.html?card=' + card, { waitUntil: 'domcontentloaded' });
        const canvas = page.locator(`[data-move-id="${clip}"] canvas[data-ready="true"]`);
        await canvas.waitFor();
        await page.evaluate(() => window.wave3Fixture.impact());
        await page.waitForFunction(clip => window.creatorVideos.some(v => v.src.includes(clip + '_chroma.mp4') && v.currentTime >= 2.8), clip);
        const alpha = await canvas.evaluate(c => {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let clear = 0, visible = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) clear++; if (d[i] > 128) visible++; }
          return { clear, visible };
        });
        assert(alpha.clear > 1000 && alpha.visible > 1000);
        await page.screenshot({ path: `screenshots/${card}-finisher-${size}.png` });
        await page.waitForFunction(clip => window.creatorVideos.some(v => v.src.includes(clip + '_chroma.mp4') && v.currentTime >= 5.7), clip);
        if (card === 'simmy') await canvas.screenshot({ path: `screenshots/simmy-keyed-finish-${size}.png` });
        await page.evaluate(() => window.wave3Fixture.ready());
        assert.equal(await page.locator('[data-move-id]').count(), 0);
        assert(await page.evaluate(clip => window.creatorVideos.every(v => !v.src.includes(clip + '_chroma.mp4')), clip));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        report.push({ size, card, clip, ...media, alpha });
      }
      assert.deepEqual(errors, []);
      console.log(size + ': both assigned clips, native audio/mute, battle playback through finish, cyan transparency and cleanup passed.');
      await page.close();
    }
    fs.writeFileSync('screenshots/creator-moves-audit.json', JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
