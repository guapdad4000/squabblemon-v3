const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const create = document.createElement.bind(document);
      document.createElement = function(tag, ...rest) { const el = create(tag, ...rest); if (tag === 'video') window.moveVideo = el; return el; };
    });
    const url = 'http://localhost:4179/squabblemon/e2e/special-move-audio.fixture.html';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('canvas[data-ready="true"]').waitFor();
    await page.getByRole('button', { name: 'Sound on', exact: true }).click();
    await page.waitForFunction(() => window.moveVideo && !window.moveVideo.muted && !window.moveVideo.paused);
    const before = await page.evaluate(() => { window.firstVideo = window.moveVideo; return window.moveVideo.currentTime; });
    await page.getByRole('button', { name: 'Mute', exact: true }).click();
    assert.ok(await page.evaluate(() => window.moveVideo === window.firstVideo && window.moveVideo.muted));
    assert.ok(await page.evaluate(() => window.moveVideo.currentTime) >= before);
    await page.evaluate(() => new Promise(resolve => { window.moveVideo.addEventListener('seeked', resolve, { once: true }); window.moveVideo.currentTime = 3.3; }));
    await page.screenshot({ path: 'screenshots/h3-og-uncle-keyed.png' });
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    assert.equal(await page.locator('canvas').count(), 0);
    assert.ok(await page.evaluate(() => window.moveVideo.paused && !window.moveVideo.hasAttribute('src')));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('canvas[data-ready="true"]').waitFor();
    await page.evaluate(() => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function() { return this.muted ? play.call(this) : Promise.reject(new DOMException('Blocked', 'NotAllowedError')); };
    });
    await page.getByRole('button', { name: 'Sound on', exact: true }).click();
    await page.waitForFunction(() => window.moveVideo.muted && !window.moveVideo.paused);
    assert.equal(await page.locator('canvas').getAttribute('data-ready'), 'true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => window.moveVideo.paused);
    assert.equal(await page.locator('canvas').getAttribute('data-ready'), 'false');
    assert.deepEqual(errors, []);
    console.log('Native audio: audible playback, immediate mute without restart, skip cleanup, blocked-audio fallback and reduced motion passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
