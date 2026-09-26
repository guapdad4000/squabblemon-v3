import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4198';
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const output = process.env.REVIEW_DIR ?? '../deliverables/level-up-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
try {
  for (const [name, width, height, query, reducedMotion] of [
    ['desktop', 1440, 1000, '', 'no-preference'],
    ['phone', 390, 844, '', 'no-preference'],
    ['small-phone', 320, 568, '', 'no-preference'],
    ['landscape', 844, 390, '', 'no-preference'],
    ['tablet', 768, 1024, '', 'no-preference'],
    ['reduced', 390, 844, '', 'reduce'],
    ['loss', 390, 844, '?outcome=loss', 'reduce'],
    ['draw', 1440, 1000, '?outcome=draw', 'reduce'],
    ['story', 390, 844, '?flow=story', 'reduce'],
    ['challenge', 768, 1024, '?flow=challenge', 'reduce'],
    ['online-exit', 390, 844, '?flow=online', 'reduce'],
    ['online-rematch', 1440, 1000, '?flow=online', 'reduce'],
    ['no-level', 390, 844, '?level=1', 'reduce'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
    await context.addInitScript(() => {
      localStorage.setItem('squabblemon:level-seen:fadecade-player', '1');
      localStorage.setItem('squabblemon_battle_feedback', JSON.stringify({ audioEnabled: true, hapticsEnabled: false }));
      window.__voices = [];
      window.__overlaps = [];
      const NativeAudio = window.Audio;
      window.Audio = class extends NativeAudio {
        constructor(src) {
          super(src);
          if (!src?.includes('/audio/voice/')) return;
          const record = { src, audio: this, plays: 0 };
          window.__voices.push(record);
          this.addEventListener('playing', () => {
            record.plays++;
            const active = window.__voices.filter(v => !v.audio.paused && !v.audio.ended);
            if (active.length > 1) window.__overlaps.push(active.map(v => v.src));
          });
        }
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/e2e/level-up.fixture.html' + query);
    await page.getByTestId('profile-level').filter({ hasText: name === 'no-level' ? '1' : '2' }).waitFor();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.level-moment').count(), 0, 'level-up waits while results are visible');
    assert.equal(await page.evaluate(() => window.__voices.filter(v => v.src.includes('/events/level-')).length), 0);
    if (name === 'desktop') {
      await page.getByTestId('button-inspect-final-board').click();
      assert.equal(await page.locator('.level-moment').count(), 0, 'board inspection is not a results exit');
      await page.getByRole('button', { name: 'View result', exact: true }).click();
    }
    if (name.startsWith('online')) await page.getByRole('button', { name: name.endsWith('rematch') ? 'Ask for a rematch' : 'Back to friend fades', exact: true }).click();
    else if (name === 'story') await page.getByRole('button', { name: 'Continue Chapter' }).click();
    else if (name === 'challenge') await page.getByRole('button', { name: 'Return to the road' }).click();
    else await page.getByTestId('button-restart-match').click();
    if (name !== 'no-level') {
      await page.locator('.level-moment').waitFor();
      assert.equal(await page.getByTestId('level-destination').count(), 0, 'the next scene is held until the level-up closes');
      await page.waitForFunction(() => window.__voices.some(v => v.src.includes('/events/level-') && v.plays === 1));
      await page.waitForTimeout(1400);
      assert.equal(await page.locator('.level-moment__orbit--outer-fists img').count(), 8);
      assert.equal(await page.locator('.level-moment img[src*="boot"]').count(), 0);
      assert(await page.locator('.level-moment__rays img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)));
      assert.equal(await page.evaluate(() => window.__voices.filter(v => v.src.includes('/events/level-')).length), 1, 'exactly one level-up take');
      assert.equal(await page.evaluate(() => window.__voices.some(v => /\/(win-[ab]|loss)\./.test(v.src) && !v.audio.paused && !v.audio.ended)), false, 'result voice is stopped before the celebration');
      const button = page.getByRole('button', { name: 'Keep applying pressure' });
      const bounds = await button.boundingBox();
      assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height);
      if (reducedMotion === 'reduce') assert.equal(await page.locator('.level-moment__star svg').evaluate(el => getComputedStyle(el).animationName), 'none');
      if (['desktop', 'phone', 'small-phone', 'landscape', 'tablet', 'reduced'].includes(name)) await page.screenshot({ path: `${output}/${name}.png` });
      if (name === 'reduced') await page.keyboard.press('Escape');
      else await button.click();
      await page.locator('.level-moment').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => window.__voices.filter(v => v.src.includes('/events/level-')).every(v => v.audio.paused)), true);
      assert.equal(await page.evaluate(() => localStorage.getItem('squabblemon:level-seen:fadecade-player')), '2');
    }
    await page.getByTestId('level-destination').waitFor();
    await page.waitForFunction(() => window.__voices.some(v => v.src.includes('/home-fade.') && v.plays === 1));
    assert.deepEqual(await page.evaluate(() => window.__overlaps), [], 'voices never overlap across the handoff');
    assert.deepEqual(errors, []);
    results.push({ name, width, height, result: 'passed' });
    console.log('PASS', name);
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
}
