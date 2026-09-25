import { selectStreetOption } from './street-select.helper.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const origin = process.env.MUSIC_ORIGIN ?? 'http://127.0.0.1:4181/squabblemon';
const tracks = JSON.parse(await readFile(new URL('../src/soundtrack.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const audioSelector = '[data-testid="background-music"]';
const playing = async page => page.waitForFunction(selector => {
  const audio = document.querySelector(selector);
  return audio && !audio.paused && audio.currentTime > 0 && audio.readyState >= 3;
}, audioSelector, { timeout: 20000 });
const paused = async page => page.waitForFunction(selector => document.querySelector(selector)?.paused, audioSelector);
const audioState = page => page.locator(audioSelector).evaluate(a => ({ time: a.currentTime, src: a.currentSrc, paused: a.paused, duration: a.duration }));
async function openMusic(page, touch = false) {
  const trigger = page.getByRole('button', { name: 'Music controls', exact: true }).first();
  if (touch) await trigger.tap(); else await trigger.click();
  await page.getByRole('dialog', { name: /Oakland Chrome/ }).waitFor();
}
try {
  for (const [name, viewport, touch] of [['desktop', { width: 1280, height: 900 }, false], ['phone', { width: 390, height: 844 }, true], ['small-phone', { width: 320, height: 740 }, true], ['landscape', { width: 844, height: 390 }, true]]) {
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
    const downloads = [];
    page.on('request', request => { if (request.url().includes('/audio/treblo/')) downloads.push(request.url()); });
    await page.goto(`${origin}/play/guest`);
    await page.getByTestId('button-start').waitFor();
    await page.waitForFunction(selector => !!document.querySelector(selector), audioSelector);
    assert.equal(downloads.length, 0, 'No audio is fetched before a gesture');
    await openMusic(page, touch); await playing(page);
    assert.equal(await page.locator(audioSelector).count(), 1);
    assert.ok((await audioState(page)).src.endsWith('wax-killa-breaks.ogg'));
    await page.screenshot({ path: `../../screenshots/music-${name}.png` });
    const panel = await page.getByRole('dialog').boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= viewport.width + 1);
    await page.getByRole('button', { name: 'Pause music', exact: true }).click(); await paused(page);
    const atPause = (await audioState(page)).time;
    await page.getByRole('button', { name: 'Next track', exact: true }).click();
    await paused(page);
    assert.equal(await page.getByRole('combobox', { name: 'Choose music track' }).getAttribute('data-value'), '1');
    await page.getByRole('slider', { name: 'Music volume' }).fill('17');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon_music_v1')).volume), 0.17);
    await page.getByRole('button', { name: 'Play music', exact: true }).click(); await playing(page);
    await page.getByRole('button', { name: 'Mute all game sound' }).click(); await paused(page);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('squabblemon_battle_feedback')).audioEnabled), false);
    await page.getByRole('button', { name: 'Enable all game sound' }).click(); await playing(page);
    if (name === 'desktop') {
      for (let index = 0; index < tracks.length; index++) {
        await selectStreetOption(page, page.getByRole('combobox', { name: 'Choose music track' }), String(index));
        await page.waitForFunction(({ selector, id }) => document.querySelector(selector)?.currentSrc.includes(id), { selector: audioSelector, id: tracks[index].id });
        await playing(page);
        const media = await audioState(page);
        assert.ok(Math.abs(media.duration - tracks[index].duration) < 1, `${tracks[index].title} decoded at the expected duration`);
      }
      await page.locator(audioSelector).evaluate(a => { a.currentTime = a.duration - 0.15; });
      await selectStreetOption(page, page.getByRole('combobox', { name: 'Choose music track' }), '5');
      await page.locator(audioSelector).evaluate(a => { a.currentTime = a.duration - 0.15; });
      await page.waitForFunction(selector => document.querySelector(selector)?.currentSrc.includes('wax-killa-breaks'), audioSelector);
      await playing(page);
      // Force actual media failures to verify the AAC retry, then decode every AAC file.
      for (let index = 0; index < tracks.length; index++) {
        await selectStreetOption(page, page.getByRole('combobox', { name: 'Choose music track' }), String(index));
        await playing(page);
        await page.locator(audioSelector).evaluate(a => a.dispatchEvent(new Event('error')));
        await page.waitForFunction(({ selector, id }) => document.querySelector(selector)?.currentSrc.endsWith(`${id}.m4a`), { selector: audioSelector, id: tracks[index].id });
        await playing(page);
      }
      await selectStreetOption(page, page.getByRole('combobox', { name: 'Choose music track' }), '0'); await playing(page);
      const beforeHidden = (await audioState(page)).time;
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await paused(page);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await playing(page); assert.ok((await audioState(page)).time >= beforeHidden);
      console.log('All six OGGs and all six AACs play; natural ending wraps; visibility pause/resume works.');
    }
    await page.getByRole('button', { name: 'Pause music', exact: true }).click(); await paused(page);
    await page.reload(); await page.getByTestId('button-start').waitFor();
    await openMusic(page, touch); await paused(page);
    assert.equal(await page.getByRole('slider', { name: 'Music volume' }).inputValue(), '17');
    await page.getByRole('button', { name: 'Play music', exact: true }).click(); await playing(page);
    await page.getByRole('button', { name: 'Close music controls' }).click();
    await page.getByTestId('button-start').click();
    for (let step = 0; step < 200; step++) {
      if (await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').count()) break;
      const fast = page.getByTestId('button-fast-forward');
      if (await fast.isVisible()) await fast.click({ force: true });
      await page.waitForTimeout(75);
    }
    await playing(page); assert.equal(await page.locator(audioSelector).count(), 1);
    await page.getByLabel('Battle menu', { exact: true }).click();
    await page.getByTestId('button-audio-toggle').click(); await paused(page);
    await openMusic(page, touch);
    await page.getByRole('button', { name: 'Enable all game sound' }).click(); await playing(page);
    await page.getByRole('button', { name: 'Close music controls' }).click();
    assert.equal(await page.getByTestId('button-audio-toggle').getAttribute('aria-pressed'), 'false');
    await page.screenshot({ path: `../../screenshots/music-battle-${name}.png` });
    console.log(`${name}: gesture playback, controls fit, pause/skip/volume persist, battle master mute stays synchronized.`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
