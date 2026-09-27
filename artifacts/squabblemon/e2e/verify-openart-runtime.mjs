import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.env.SPECIALS_BASE_URL ?? 'http://localhost:4211';
const manifest = JSON.parse(await readFile(new URL('../reference/openart-specials.json', import.meta.url), 'utf8'));
const output = new URL('../../deliverables/openart-specials/review/runtime-verification.json', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { clips: [], fullPlayback: [], battle: [], controls: [], errors: [] };
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => results.errors.push(error.message));
  // SpecialMove intentionally keeps its video off-DOM. Observe that real element,
  // without changing the renderer, playback rate, source, or sound preferences.
  await page.addInitScript(() => {
    window.runtimeVideos = [];
    const create = document.createElement.bind(document);
    document.createElement = function (tag, options) {
      const element = create(tag, options);
      if (tag.toLowerCase() === 'video') window.runtimeVideos.push(element);
      return element;
    };
  });
  await page.goto(`${base}/e2e/special-moves.fixture.html?card=${manifest.clips[0].engineId}`);
  const ready = async () => {
    await page.waitForSelector('[data-testid="special-move-canvas"][data-ready="true"]');
    await page.waitForFunction(() => window.runtimeVideos.some(v => v.currentTime > 0 && !v.paused));
  };
  const inspect = () => page.evaluate(() => {
    const video = window.runtimeVideos.findLast(v => v.currentSrc);
    const canvas = document.querySelector('[data-testid="special-move-canvas"]');
    return { url: video.currentSrc, duration: video.duration, width: canvas.width, height: canvas.height,
      renderer: canvas.dataset.renderer, muted: video.muted, volume: video.volume, rate: video.playbackRate };
  });
  for (const clip of manifest.clips) {
    if (await page.getByRole('combobox', { name: 'Card', exact: true }).getAttribute('data-value') !== clip.engineId) {
      await page.getByRole('combobox', { name: 'Card', exact: true }).click();
      await page.locator(`[role="option"][data-value="${clip.engineId}"]`).click();
    }
    await page.waitForFunction(file => window.runtimeVideos.some(v => v.currentSrc.includes(file) && v.currentTime > 0), clip.file);
    await ready();
    const state = await inspect();
    assert.ok(state.url.endsWith(`/assets/special-moves/${clip.file}?v=${clip.sha256.slice(0, 16)}`), clip.engineId);
    assert.ok(Math.abs(state.duration - clip.durationSeconds) < .002, clip.engineId);
    assert.equal(state.width, 288); assert.equal(state.height, 504);
    assert.equal(state.renderer, 'gpu'); assert.equal(state.muted, true); assert.equal(state.rate, 1);
    results.clips.push({ engineId: clip.engineId, ...state });
    if (results.clips.length % 20 === 0) console.log(`${results.clips.length}/100 runtime assignments and rendered playback passed`);
  }
  for (const duration of [8, 5.167]) {
    const clip = manifest.clips.find(c => c.durationSeconds === duration);
    await page.goto(`${base}/e2e/special-moves.fixture.html?card=${clip.engineId}`);
    await ready();
    await page.waitForFunction(() => window.runtimeVideos.some(v => v.ended), null, { timeout: 12000 });
    const end = await page.evaluate(() => {
      const v = window.runtimeVideos.findLast(v => v.currentSrc);
      return { time: v.currentTime, duration: v.duration, ended: v.ended };
    });
    assert.ok(end.ended && Math.abs(end.time - duration) < .01);
    results.fullPlayback.push({ engineId: clip.engineId, ...end });
  }
  await page.goto(`${base}/e2e/special-moves.fixture.html?card=demario`);
  await ready();
  assert.ok((await page.locator('body').innerText()).includes('Special Delivery'));
  await page.getByRole('button', { name: 'Play with sound', exact: true }).click();
  await ready();
  await page.waitForFunction(() => window.runtimeVideos.some(v => v.currentSrc && !v.muted && !v.paused));
  assert.equal((await inspect()).volume, .7);
  await page.getByRole('button', { name: 'Mute preview', exact: true }).click();
  assert.equal((await inspect()).muted, true);
  results.controls.push('Sound on and mute update the playing video');

  // Simulate a WebGL context loss to exercise the production CPU fallback.
  await page.locator('[data-testid="special-move-canvas"]').evaluate(c => c.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await page.waitForSelector('[data-renderer="cpu"][data-ready="true"]');
  results.controls.push('GPU context loss recovers with CPU renderer');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('[role="status"]').textContent.includes('Reduced motion'));
  assert.equal(await page.locator('[data-ready="true"]').count(), 0);
  results.controls.push('Reduced motion stops animation and retains card fallback');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.route('**/assets/special-moves/oa-dr-fade-v1.mp4*', route => route.abort());
  await page.goto(`${base}/e2e/special-moves.fixture.html?card=drfade`);
  await page.getByRole('status').filter({ hasText: 'Clip unavailable' }).waitFor();
  assert.equal(await page.locator('[data-ready="true"]').count(), 0);
  assert.equal(await page.locator('.move-studio-stage > img').evaluate(img => img.complete && img.naturalWidth > 0), true);
  results.controls.push('Missing media falls back to visible card');
  await page.unroute('**/assets/special-moves/oa-dr-fade-v1.mp4*');

  for (const card of ['drfade', 'demario', 'counter', 'sugarfoot']) {
    await page.goto(`${base}/e2e/wave3-moves.fixture.html?card=${card}`);
    await ready();
    const clip = manifest.clips.find(c => c.engineId === card);
    assert.equal(await page.locator('.battle-special-move').getAttribute('data-move-id'), clip.clipId);
    await page.evaluate(() => window.wave3Fixture.impact());
    await page.waitForSelector('[data-testid="character-attack"][data-impact="true"]');
    assert.equal(await page.locator('[data-testid="character-attack"]').getAttribute('data-impact'), 'true');
    await page.evaluate(() => window.wave3Fixture.ready());
    await page.waitForFunction(() => !document.querySelector('.battle-special-move'));
    await page.waitForFunction(() => window.runtimeVideos.filter(v => v.currentSrc.includes('/special-moves/'))
      .every(v => v.paused && !v.getAttribute('src')));
    results.battle.push({ engineId: card, animation: true, impact: true, cleanup: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/e2e/special-moves.fixture.html?card=drfade`);
  await ready();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  results.controls.push('Workshop fits 390px mobile viewport');
  assert.deepEqual(results.errors, []);
  results.passed = true;
  console.log('All 100 runtime clips passed; full 5/8-second playback, sound, CPU/reduced-motion/media fallbacks, battle wiring and cleanup passed.');
} finally {
  if (!results.passed && page) {
    results.failureState = await page.evaluate(() => ({ url: location.href, status: document.querySelector('[role="status"]')?.textContent,
      videos: window.runtimeVideos?.map(v => ({ url: v.currentSrc, ready: v.readyState, time: v.currentTime, paused: v.paused, error: v.error?.message })) })).catch(() => null);
  }
  await writeFile(output, JSON.stringify(results, null, 2) + '\n');
  await browser.close();
}
