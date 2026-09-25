import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4198';
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE ?? '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
await mkdir('screenshots/battle-announcer', { recursive: true });
async function context(aac) {
  const context = await browser.newContext({ viewport: { width: aac ? 390 : 1440, height: 900 }, reducedMotion: 'reduce', isMobile: aac, hasTouch: aac });
  await context.addInitScript(aac => {
    window.__voices = []; window.__voiceErrors = []; window.__overlap = false; window.__musicPauses = 0;
    window.__gains = new WeakMap();
    const nativeSource = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (audio) {
      const source = nativeSource.call(this, audio), connect = source.connect;
      source.connect = function (node, ...args) { window.__gains.set(audio, node); return connect.call(this, node, ...args); };
      return source;
    };
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/dr-fade/battle/') && !window.__voices.some(v => v.audio === this)) {
        const entry = { audio: this, name: this.src.split('/').at(-1).split('.')[0], extension: this.src.split('.').at(-1), plays: 0, starts: 0, ends: 0 };
        window.__voices.push(entry);
        this.addEventListener('playing', () => { entry.plays++; entry.starts = performance.now(); if (window.__voices.filter(v => !v.audio.paused && !v.audio.ended).length > 1) window.__overlap = true; });
        this.addEventListener('ended', () => { entry.ends = performance.now(); });
        this.addEventListener('error', () => window.__voiceErrors.push(entry.name));
      }
      return nativePlay.call(this);
    };
    document.addEventListener('pause', event => { if (event.target.dataset?.testid === 'background-music') window.__musicPauses++; }, true);
    if (aac) {
      // Model iOS's read-only media volume; its gain node must still honor the slider.
      const nativeVolume = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
      Object.defineProperty(HTMLMediaElement.prototype, 'volume', { ...nativeVolume, set() {} });
      const nativeCanPlay = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function (type) { return type.includes('vorbis') ? '' : nativeCanPlay.call(this, type); };
    }
  }, aac);
  return context;
}
const cue = (page, name, count = 1) => page.waitForFunction(({ name, count }) => window.__voices.filter(v => v.name === name && v.plays === 1).length === count, { name, count });
const settled = page => page.waitForFunction(() => window.__voices.length > 0 && window.__voices.every(v => v.audio.paused));
const names = page => page.evaluate(() => window.__voices.map(v => v.name));
const musicState = page => page.locator('[data-testid=background-music]').evaluate(a => ({ time: a.currentTime, paused: a.paused, volume: window.__gains.get(a)?.gain.value ?? a.volume, src: a.currentSrc, pauses: window.__musicPauses }));
const musicPlaying = page => page.waitForFunction(() => { const a = document.querySelector('[data-testid=background-music]'); return a && !a.paused && a.currentTime > 0; });
async function check(page, errors, aac) {
  assert.deepEqual(errors, []);
  const values = await page.evaluate(() => ({ errors: window.__voiceErrors, overlap: window.__overlap, voices: window.__voices.map(v => ({ extension: v.extension, plays: v.plays })) }));
  assert.deepEqual(values.errors, []);
  assert.equal(values.overlap, false);
  assert(values.voices.every(v => v.extension === (aac ? 'm4a' : 'ogg') && v.plays === 1));
}
try {
  for (const aac of [false, true]) {
    const ctx = await context(aac), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/e2e/battle-announcer.fixture.html');
    await page.getByRole('button', { name: 'Music controls', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'The Fade Tapes' });
    await dialog.getByRole('slider', { name: 'Music volume', exact: true }).fill('24');
    await dialog.getByRole('slider', { name: 'Battle announcer volume' }).fill('37');
    await musicPlaying(page);
    await page.screenshot({ path: `screenshots/battle-announcer/controls-${aac ? 'phone' : 'desktop'}.png` });
    const box = await dialog.boundingBox(); assert(box.x >= 0 && box.x + box.width <= (aac ? 391 : 1441));
    await dialog.getByRole('button', { name: 'Close music controls' }).click();
    // Music intentionally fades to its target; measure after that existing ramp settles.
    await page.waitForFunction(() => Math.abs(window.__gains.get(document.querySelector('[data-testid=background-music]')).gain.value - 0.24) < 0.00001);
    const before = await musicState(page);
    await page.getByRole('button', { name: 'Intro', exact: true }).click();
    await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await cue(page, 'round-1'); await cue(page, 'your-turn-1'); await settled(page);
    await page.getByRole('button', { name: 'Resolve card' }).click();
    await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await page.waitForTimeout(150);
    assert.deepEqual(await names(page), ['round-1', 'your-turn-1']);
    assert(await page.evaluate(() => window.__voices.every(v => Math.abs(window.__gains.get(v.audio).gain.value - 0.37) < 0.0001)));
    const after = await musicState(page);
    assert(after.time > before.time && !after.paused && after.pauses === before.pauses && Math.abs(after.volume - before.volume) < 0.001 && after.src === before.src, `announcements never interrupt or change music: ${JSON.stringify({ before, after })}`);
    await page.getByRole('button', { name: 'Final round', exact: true }).click();
    await cue(page, 'final-round');
    await page.getByRole('button', { name: 'Music controls', exact: true }).first().click();
    await dialog.getByRole('slider', { name: 'Battle announcer volume' }).fill('19');
    assert(await page.evaluate(() => Math.abs(window.__gains.get(window.__voices.find(v => v.name === 'final-round').audio).gain.value - 0.19) < 0.0001));
    await cue(page, 'your-turn-1', 2); await settled(page);
    const timing = await page.evaluate(() => ({ final: window.__voices[2].ends, turn: window.__voices[3].starts }));
    assert(timing.final > 0 && timing.turn >= timing.final, 'final round is fully heard before your turn');
    await dialog.getByRole('slider', { name: 'Battle announcer volume' }).fill('0');
    await page.reload();
    await page.getByRole('button', { name: 'Music controls', exact: true }).first().click();
    assert.equal(await dialog.getByRole('slider', { name: 'Battle announcer volume' }).inputValue(), '0');
    assert.equal(await dialog.getByRole('slider', { name: 'Music volume', exact: true }).inputValue(), '24');
    await dialog.getByRole('button', { name: 'Close music controls' }).click();
    await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await page.waitForTimeout(200); assert.deepEqual(await names(page), []); await musicPlaying(page);
    await page.getByRole('button', { name: 'Music controls', exact: true }).first().click();
    await dialog.getByRole('slider', { name: 'Battle announcer volume' }).fill('80');
    await dialog.getByRole('button', { name: 'Close music controls' }).click();
    await page.getByRole('button', { name: 'Next round', exact: true }).click(); await cue(page, 'round-2');
    await page.getByRole('button', { name: 'Leave fixture' }).click();
    assert(await page.evaluate(() => window.__voices.every(v => v.audio.paused)));
    await check(page, errors, aac);
    console.log(`PASS ${aac ? 'phone AAC' : 'desktop OGG'}: sequencing, StrictMode, independent live/persisted volume, mute, music continuity, exit cleanup`);
    await ctx.close();
  }
  for (const limit of [4, 5]) {
    const ctx = await context(false), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/e2e/battle-announcer.fixture.html?limit=${limit}`);
    await page.getByRole('button', { name: 'Final round', exact: true }).click();
    await cue(page, 'final-round'); await cue(page, `your-turn-${limit}`); await settled(page);
    assert.deepEqual(await names(page), ['final-round', `your-turn-${limit}`]);
    await check(page, errors, false);
    console.log(`PASS final recording on ${limit}-round encounter`);
    await ctx.close();
  }
  for (const seat of ['host', 'guest']) {
    const ctx = await context(false), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/e2e/battle-announcer.fixture.html?mode=online&seat=${seat}`);
    await cue(page, 'round-1');
    if (seat === 'guest') {
      await settled(page); assert.deepEqual(await names(page), ['round-1']);
      await page.getByRole('button', { name: 'Advance online turn' }).click();
    }
    await cue(page, 'your-turn-1'); await settled(page);
    for (const label of ['Toggle busy', 'Toggle connection']) {
      await page.getByRole('button', { name: label }).click();
      await page.getByRole('button', { name: label }).click();
    }
    await page.waitForTimeout(200); assert.deepEqual(await names(page), ['round-1', 'your-turn-1']);
    for (let i = 0; i < (seat === 'host' ? 2 : 1); i++) await page.getByRole('button', { name: 'Advance online turn' }).click();
    await cue(page, 'round-2');
    if (seat === 'host') { await settled(page); assert.equal((await names(page)).at(-1), 'round-2'); await page.getByRole('button', { name: 'Advance online turn' }).click(); }
    await cue(page, 'your-turn-2'); await settled(page);
    await check(page, errors, false);
    console.log(`PASS online ${seat}: VS gate, rival-first rounds, turn ownership, busy/reconnect deduplication`);
    await ctx.close();
  }
  // Exercise the real solo loop, including a card animation and every round boundary.
  const ctx = await context(false), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  async function ready(round) {
    for (let i = 0; i < 300; i++) {
      const lesson = page.getByRole('button', { name: 'Back to the battle', exact: true });
      if (await lesson.isVisible()) await lesson.click({ timeout: 600 }).catch(() => {});
      else if (await page.locator(`[data-testid=battle-arena][data-presentation-phase=player-ready] .battle-round[aria-label="Round ${round} of 6"]`).count()) return;
      else {
        const skip = page.getByRole('button', { name: /Fast forward|Continue past/ }).first();
        if (await skip.isVisible()) await skip.click({ timeout: 500 }).catch(() => {});
      }
      await page.waitForTimeout(75);
    }
    throw Error(`Solo round ${round} did not become playable`);
  }
  await page.goto(origin + '/play/guest');
  await page.getByTestId('button-start').click();
  const expected = [];
  for (let round = 1; round <= 6; round++) {
    await ready(round);
    const roundCue = round === 6 ? 'final-round' : `round-${round}`;
    const turnCue = `your-turn-${(round - 1) % 5 + 1}`;
    await cue(page, roundCue); await cue(page, turnCue, round === 6 ? 2 : 1); await settled(page);
    expected.push(roundCue, turnCue);
    if (round === 1) {
      const card = page.locator('#hand-tray [data-card-id]:not([aria-label*="Cannot play"])').first();
      await card.click();
      await page.locator('[data-testid^="lane-"][aria-label^="Deploy"]').first().click();
      await page.getByRole('button', { name: /^Play card/ }).click();
      await ready(round);
      assert.deepEqual(await names(page), expected, 'playing a card never repeats the round or your-turn cue');
    }
    await musicPlaying(page);
    assert.deepEqual(await names(page), expected);
    if (round < 6) await page.getByRole('button', { name: 'End Turn', exact: true }).click();
  }
  await check(page, errors, false);
  console.log('PASS actual six-round solo battle: every round/turn, card play deduplication, final-round replacement, music playing throughout');
  await ctx.close();
} finally { await browser.close(); }
