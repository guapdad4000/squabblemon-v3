import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { cardCatalog, starterRecipes } from '@workspace/squabblemon-engine/data';
import { profileBootstrap, signIn } from './fighter-id.fixture.ts';

const origin = process.env.UI_ORIGIN ?? 'http://localhost:4210';
const output = fileURLToPath(new URL('../../deliverables/fade-phone-review/', import.meta.url));
await mkdir(output, { recursive: true });
const recipe = starterRecipes[0];
const bootstrap = profileBootstrap({
  ownedCardIds: cardCatalog.map(c => c.catalogId),
  savedDecks: [{ id: 'phone-crew', name: 'THE REGULARS', cardIds: recipe.catalogCardIds, heroCardId: recipe.hero, valid: true, issues: [], recipeId: null }],
});
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });

async function observeAudio(page) {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.__phoneClips = [];
    window.__musicEvents = [];
    window.Audio = new Proxy(NativeAudio, { construct(target, args) {
      const audio = Reflect.construct(target, args);
      if (String(args[0]).includes('phone-ring.mp3')) {
        window.__phoneClips.push(audio);
        audio.addEventListener('play', () => { audio.dataset.plays = String(Number(audio.dataset.plays ?? 0) + 1); });
      }
      return audio;
    } });
    for (const method of ['play', 'pause']) {
      const native = HTMLMediaElement.prototype[method];
      HTMLMediaElement.prototype[method] = function(...args) {
        if (this.dataset.testid === 'background-music') window.__musicEvents.push({ method, src: this.currentSrc, at: performance.now() });
        return native.apply(this, args);
      };
    }
    window.__musicGains = [];
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function() { const gain = createGain.call(this); window.__musicGains.push(gain); return gain; };
  });
}
async function mockLobby(page, controls = {}) {
  let room = null;
  await page.routeWebSocket('**', socket => socket.close());
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/ranked/search')) {
      if (controls.failSearch) return route.fulfill({ status: 503, json: { error: 'Try the call again.' } });
      room = { code: 'PHONE1', status: 'waiting', ranked: { queuedAt: Date.now() } };
      await new Promise(resolve => setTimeout(resolve, 150));
      return route.fulfill({ json: { room } });
    }
    if (path.endsWith('/ranked/cancel')) {
      if (controls.failCancel) return route.fulfill({ status: 503, json: { error: 'Still connected. Try again.' } });
      const canceled = { ...room, status: controls.matched ? 'active' : 'cancelled' };
      room = null;
      return route.fulfill({ json: canceled });
    }
    if (path.endsWith('/ranked')) {
      if (room && controls.matched) room = { ...room, status: 'active' };
      return route.fulfill({ json: { room } });
    }
    const body = path.endsWith('/bootstrap') ? bootstrap
      : path.endsWith('/mail') ? { messages: [] }
      : path.endsWith('/daily-clout') ? { available: false, resetsAt: '2026-09-26T00:00:00Z' }
      : path.includes('/multiplayer') ? { rooms: [] } : {};
    return route.fulfill({ json: body });
  });
}
async function allRingsStopped(page) {
  await page.waitForFunction(() => window.__phoneClips.every(audio => audio.paused));
}

try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await signIn(page);
    await observeAudio(page);
    const controls = {};
    await mockLobby(page, controls);
    await page.goto(`${origin}/game/online`);
    const call = page.getByTestId('find-ranked-fade');
    await call.waitFor();
    await page.locator('.fade-phone__receiver img').evaluate(image => image.decode());
    await page.waitForTimeout(800);
    const layout = await page.evaluate(() => {
      const rect = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { x:b.x, y:b.y, width:b.width, height:b.height, right:b.right, bottom:b.bottom }; };
      const image = document.querySelector('.fade-phone__receiver img');
      return { title:rect('.park-intro'), tabs:rect('.park-topbar'), phone:rect('.fade-finder'), image:rect('.fade-phone__receiver img'), deck:rect('.park-crew-carousel'), ratio:image.naturalWidth/image.naturalHeight, overflow:document.documentElement.scrollWidth>innerWidth };
    });
    assert.equal(layout.overflow, false, `overflow at ${width}`);
    assert(layout.title.y - layout.tabs.bottom < 50, `title is not at the top at ${width}`);
    assert(Math.abs(layout.image.height/layout.image.width-layout.ratio) < .01, 'handset proportions changed');
    assert(layout.phone.x >= 0 && layout.phone.right <= width, `phone outside screen at ${width}`);
    assert(layout.image.height > layout.image.width * 3, 'receiver must stand vertically');
    if (width > 1000) assert(layout.image.right < layout.deck.x, 'desktop receiver must sit beside the picker');
    else {
      assert(layout.phone.bottom <= layout.deck.y, 'mobile phone must sit above the picker');
      assert(layout.deck.width >= width - (width > 500 ? 320 : 36), 'mobile deck picker must retain its full width');
    }
    await page.screenshot({ path: `${output}resting-${width}.png`, fullPage: true });
    await call.click();
    await page.getByTestId('ranked-search').waitFor();
    assert.equal(await page.getByTestId('fade-phone').getAttribute('data-lifted'), 'true');
    assert(await page.getByTestId('deck-carousel').isVisible());
    await page.waitForFunction(() => window.__phoneClips.some(audio => Number(audio.dataset.plays) > 0));
    await page.waitForTimeout(700);
    if (width === 1440 || width === 390) await page.screenshot({ path: `${output}calling-${width}.png`, fullPage: true });
    if (width === 1440) {
      const musicBefore = await page.evaluate(() => {
        const audio = document.querySelector('[data-testid="background-music"]');
        return { src:audio.currentSrc, time:audio.currentTime, volume:audio.volume, gains:window.__musicGains.map(g => g.gain.value), pauses:window.__musicEvents.filter(e => e.method==='pause').length };
      });
      await page.waitForTimeout(4700);
      const musicAfter = await page.evaluate(() => {
        const audio = document.querySelector('[data-testid="background-music"]');
        return { src:audio.currentSrc, time:audio.currentTime, paused:audio.paused, volume:audio.volume, gains:window.__musicGains.map(g => g.gain.value), pauses:window.__musicEvents.filter(e => e.method==='pause').length, rings:window.__phoneClips.reduce((n,a)=>n+Number(a.dataset.plays??0),0), ringVolumes:window.__phoneClips.map(a=>a.volume) };
      });
      assert.equal(musicAfter.src, musicBefore.src);
      assert(musicAfter.time > musicBefore.time + 3);
      assert.equal(musicAfter.paused, false);
      assert.equal(musicAfter.pauses, musicBefore.pauses);
      assert.equal(musicAfter.volume, musicBefore.volume);
      assert.deepEqual(musicAfter.gains, musicBefore.gains);
      assert(musicAfter.rings >= 2);
      assert(musicAfter.ringVolumes.every(v => v <= .22));
      controls.failCancel = true;
      await page.getByTestId('cancel-ranked-fade').click();
      await page.locator('.park-notice').waitFor();
      assert.equal(await page.getByTestId('fade-phone').getAttribute('data-lifted'), 'true', 'failed cancel must keep the call active');
      controls.failCancel = false;
    }
    await page.getByTestId('cancel-ranked-fade').click();
    await page.getByTestId('find-ranked-fade').waitFor();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(750);
    assert.equal(await page.getByTestId('fade-phone').getAttribute('data-lifted'), 'false');
    assert.equal(await page.locator('.fade-phone__receiver').evaluate(el => getComputedStyle(el).transform), 'none');
    await allRingsStopped(page);
    const plays = await page.evaluate(() => window.__phoneClips.reduce((n,a)=>n+Number(a.dataset.plays??0),0));
    if (width === 1440) {
      await page.waitForTimeout(4700);
      assert.equal(await page.evaluate(() => window.__phoneClips.reduce((n,a)=>n+Number(a.dataset.plays??0),0)), plays, 'ring timer survived hang-up');
      controls.failSearch = true;
      await page.getByTestId('find-ranked-fade').click();
      await page.waitForFunction(() => document.querySelector('[data-testid="fade-phone"]')?.getAttribute('data-lifted') === 'false');
      await allRingsStopped(page);
    }
    console.log('PASS', width, JSON.stringify(layout));
    assert.deepEqual(errors, []);
    await page.close();
  }

  // Active match navigation, mute updates, and reduced motion use the existing isolated lobby fixture.
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await observeAudio(page);
  const controls = {};
  await mockLobby(page, controls);
  await page.goto(`${origin}/e2e/fade-marker.fixture.html`);
  await page.getByTestId('find-ranked-fade').click();
  await page.getByTestId('ranked-search').waitFor();
  assert(Number.parseFloat(await page.locator('.fade-phone__receiver').evaluate(el => getComputedStyle(el).transitionDuration)) < .001);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('squabblemon:feedback-change', { detail: { audioEnabled:false, hapticsEnabled:false } })));
  await allRingsStopped(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('squabblemon:feedback-change', { detail: { audioEnabled:true, hapticsEnabled:false } })));
  await page.waitForFunction(() => window.__phoneClips.some(audio => !audio.paused));
  controls.matched = true;
  await page.getByTestId('active-room').waitFor();
  await allRingsStopped(page);
  const count = await page.evaluate(() => window.__phoneClips.reduce((n,a)=>n+Number(a.dataset.plays??0),0));
  await page.waitForTimeout(4700);
  assert.equal(await page.evaluate(() => window.__phoneClips.reduce((n,a)=>n+Number(a.dataset.plays??0),0)), count, 'ring timer survived entering a match');
  await page.close();
  console.log('PASS audio overlap, mute, cancellation failure, search failure, match-found cleanup, and reduced motion');
} finally {
  await browser.close();
}
