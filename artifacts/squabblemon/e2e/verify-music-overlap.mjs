import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.MUSIC_ORIGIN ?? 'http://127.0.0.1:4181/squabblemon';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__audioProof = { oscillators: 0, contexts: 0, pauses: 0, plays: 0, voices: 0 };
    const Context = window.AudioContext;
    window.AudioContext = class extends Context {
      constructor(...args) {
        super(...args);
        window.__audioProof.contexts++;
      }
      createOscillator() {
        window.__audioProof.oscillators++;
        return super.createOscillator();
      }
    };
    const AudioElement = window.Audio;
    window.Audio = class extends AudioElement {
      constructor(...args) {
        super(...args);
        if (args[0]?.includes('/audio/voice/')) {
          this.addEventListener('playing', () => window.__audioProof.voices++);
        }
      }
    };
    new MutationObserver(() => {
      const audio = document.querySelector('[data-testid="background-music"]');
      if (audio && !audio.dataset.observed) {
        audio.dataset.observed = 'true';
        audio.addEventListener('pause', () => window.__audioProof.pauses++);
        audio.addEventListener('play', () => window.__audioProof.plays++);
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(`${origin}/e2e/special-move-audio.fixture.html`);
  const music = page.locator('[data-testid="background-music"]');
  await page.getByRole('button', { name: 'Play music' }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="background-music"]')?.currentTime > .2);
  const start = await music.evaluate(a => ({ src: a.currentSrc, time: a.currentTime }));
  await page.getByRole('button', { name: 'Fire cue' }).click();
  await page.getByRole('button', { name: 'SQUABBLE voice' }).click();
  await page.getByRole('button', { name: 'Sound on' }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="special-move-canvas"]')?.dataset.ready === 'true');
  await page.getByRole('button', { name: 'Fire cue' }).click();
  await page.waitForTimeout(900);
  const result = await page.evaluate(() => {
    const audio = document.querySelector('[data-testid="background-music"]');
    const clip = document.querySelector('[data-testid="special-move-canvas"]');
    return { src: audio.currentSrc, time: audio.currentTime, paused: audio.paused,
      muted: clip.dataset.muted, ...window.__audioProof };
  });
  assert.equal(result.src, start.src, 'battle effects must not select another track');
  assert.ok(result.time > start.time, 'soundtrack position keeps advancing through effects and video');
  assert.equal(result.paused, false);
  assert.equal(result.pauses, 0, 'effects and video must not pause the soundtrack');
  assert.equal(result.plays, 1, 'effects and video must not restart the soundtrack');
  assert.ok(result.oscillators > 0, 'synthesized cue sounded during overlap');
  assert.ok(result.voices > 0, 'SQUABBLE voice played without stopping the music');
  assert.equal(result.contexts, 1, 'music and feedback use the same audio context');
  assert.equal(result.muted, 'false', 'special video is audible when autoplay permits it');
  await page.getByRole('button', { name: 'Music volume zero' }).click();
  await page.getByRole('button', { name: 'Fire cue' }).click();
  assert.ok((await page.evaluate(() => window.__audioProof.oscillators)) > result.oscillators, 'music volume cannot suppress cues');
  await page.getByRole('button', { name: 'Pause music' }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="background-music"]')?.paused);
  const pausedAt = await music.evaluate(a => a.currentTime);
  await page.getByRole('button', { name: 'Fire cue' }).click();
  await page.waitForTimeout(200);
  assert.equal(await music.evaluate(a => a.currentTime), pausedAt, 'a cue cannot override deliberate music pause');
  assert.deepEqual(errors, []);
  console.log('Browser overlap: continuous soundtrack, shared context, audible special, independent cues and pause.');
} finally {
  await browser.close();
}