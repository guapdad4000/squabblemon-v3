import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4198';
const executablePath = process.env.BROWSER_EXECUTABLE;
const homeLessons = JSON.parse(await readFile('src/lib/safehouseTour.json', 'utf8'));
const recordedClips = JSON.parse(await readFile('src/lib/tutorialVoiceClips.json', 'utf8'));
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
const battleFile = 'e2e/tutorial-voice-battle.generated.tsx';
const battleHtml = 'e2e/tutorial-voice-battle.generated.html';
const battle = (await readFile('e2e/rookie-road.fixture.tsx', 'utf8'))
  .replaceAll('ROOKIE_CORE_IDS', 'ROOKIE_MENTOR_CORE_IDS')
  .replace('catalogIdsToEngineIds(ROOKIE_MENTOR_CORE_IDS)', "catalogIdsToEngineIds(ROOKIE_MENTOR_CORE_IDS.map((id, index) => index === 5 ? 'landlord' : id))")
  .replace('commit={commit}', 'commit={() => commit(false)} endTurn={() => commit(true)}');
await writeFile(battleFile, battle);
await writeFile(battleHtml, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="./tutorial-voice-battle.generated.tsx"></script></body></html>');

async function verify(width, aac) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: width < 600, isMobile: width < 600, reducedMotion: 'reduce' });
  await page.routeWebSocket('**', socket => socket.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Fixture endpoints are isolated from account state and real reward claims.
  await page.route('**/api/**', route => route.request().url().includes('/rewards/account')
    ? route.fulfill({ json: { streak: 1, pending: [], date: '2026-09-25' } })
    : route.fulfill({ status: 503, json: { error: 'Offline voice fixture' } }));
  await page.route('**/scenes/**', route => /\.(png|jpe?g|webp|mp4)(\?|$)/.test(route.request().url()) ? route.abort() : route.continue());
  await page.addInitScript(forceAac => {
    window.__voiceAudio = [];
    window.__voicePlayed = [];
    window.__voiceErrors = [];
    window.__voiceFinished = [];
    window.__voiceOverlap = false;
    if (forceAac) {
      const canPlayType = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function (type) { return type.includes('vorbis') ? '' : canPlayType.call(this, type); };
    }
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src) {
        super(src);
        if (src?.includes('/dr-fade/battle/')) window.__roundAnnouncements = (window.__roundAnnouncements ?? 0) + 1;
        if (!src?.includes('/dr-fade/tutorial/')) return;
        this.__cueName = new URL(src, location.href).pathname.split('/').at(-1);
        window.__voiceAudio.push(this);
        this.addEventListener('playing', () => {
          window.__voicePlayed.push(new URL(src, location.href).pathname.split('/').at(-1));
          if (window.__voiceAudio.filter(a => !a.paused && !a.ended).length > 1) window.__voiceOverlap = true;
        });
        this.addEventListener('error', () => window.__voiceErrors.push({ src, code: this.error?.code }));
        this.addEventListener('ended', () => window.__voiceFinished.push({ name: new URL(src, location.href).pathname.split('/').at(-1), time: this.currentTime, duration: this.duration }));
      }
    };
  }, aac);
  const voice = async id => {
    try {
      const candidates = (Array.isArray(id) ? id : [id]).map(value => value + (aac ? '.m4a' : '.ogg'));
      await page.waitForFunction(expected => window.__voiceAudio.some(a => expected.some(name => new URL(a.src, location.href).pathname.endsWith(name)) && !a.paused && a.readyState >= 2), candidates, { timeout: 10000 });
    } catch (error) {
      const state = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 350), text: document.querySelector('.fade-tip')?.textContent, played: window.__voicePlayed, audio: window.__voiceAudio.map(a => ({ src: a.src, paused: a.paused, ready: a.readyState, time: a.currentTime })), errors: window.__voiceErrors }));
      throw new Error(`Expected ${id}: ${JSON.stringify({ ...state, pageErrors: errors })}; ${error.message}`);
    }
  };
  const finishVoice = () => page.evaluate(() => {
    const audio = window.__voiceAudio.find(a => !a.paused && !a.ended);
    if (audio) audio.currentTime = Math.max(0, audio.duration - .03);
  });
  const click = locator => width < 600 ? locator.first().tap() : locator.first().click();
  const clickCoach = async () => {
    const panel = page.getByTestId('fade-spotlight');
    const buttons = panel.locator('button.venue-button');
    if (await buttons.count()) return click(buttons);
    const target = await panel.getAttribute('data-coach-target');
    if (target === '.safehouse-room-actions') return click(page.getByRole('button', { name: 'Build your gang', exact: true }));
    return click(page.locator(target));
  };
  const clean = async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.__voiceErrors), []);
    assert.equal(await page.evaluate(() => window.__voiceOverlap), false);
    assert.equal(await page.evaluate(() => window.__roundAnnouncements ?? 0), 0, 'Round announcements stay silent during coaching');
  };

  await page.route('**/api/player/decks/**', async route => route.request().method() === 'PUT'
    ? route.fulfill({ json: await page.evaluate(() => window.__ROOKIE_BOOTSTRAP_B) })
    : route.fulfill({ status: 503, json: { error: 'Offline voice fixture' } }));
  await page.goto(origin + '/e2e/rookie-journey.fixture.html');
  await voice('welcome');
  await finishVoice(); await voice('welcome-reassurance');
  await click(page.getByRole('button', { name: 'Show me around' }));
  for (const step of homeLessons) {
    const recording = step.id === 'home-5'
      ? recordedClips.find(clip => clip.id === 'expanded-home-gang')
      : recordedClips.find(clip => clip.text === step.body);
    await page.getByRole('heading', { name: step.title, exact: true }).waitFor();
    if (recording) await voice(recording.id);
    else assert.equal(await page.evaluate(() => window.__voiceAudio.every(a => a.paused)), true, 'unrecorded tour copy must not play an outdated line');
    if (step.id === 'home-1') {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('squabblemon:feedback-change', { detail: { audioEnabled: false, hapticsEnabled: false } })));
      assert.equal(await page.evaluate(() => window.__voiceAudio.every(a => a.paused)), true);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('squabblemon:feedback-change', { detail: { audioEnabled: true, hapticsEnabled: false } })));
      await voice('home-1');
    }
    await clickCoach();
  }
  await voice('legendary-catchphrase');
  await finishVoice(); await voice('legendary-explanation');
  await finishVoice(); await voice('legendary-squabble');
  await click(page.getByRole('button', { name: 'Build with Dr. Fade' }));
  await voice('expanded-deck-lineup'); await clickCoach();
  await voice('expanded-deck-recruit'); await clickCoach();
  await voice('expanded-deck-confirm');
  await page.waitForFunction(ext => window.__voiceFinished.some(clip => clip.name === `expanded-deck-confirm.${ext}`), aac ? 'm4a' : 'ogg', { timeout: 12000 });
  const finished = await page.evaluate(ext => window.__voiceFinished.find(clip => clip.name === `expanded-deck-confirm.${ext}`), aac ? 'm4a' : 'ogg');
  assert.ok(finished.time >= finished.duration - .12, `spoken last word must finish naturally: ${JSON.stringify(finished)}`);
  await clickCoach();
  await voice('expanded-deck-ready');
  await clickCoach();
  await page.getByTestId('rookie-fight-brief').waitFor();
  await voice('expanded-fight-goal');
  await finishVoice(); await voice('expanded-fight-format');
  await click(page.getByRole('button', { name: 'Back to my gang' }));
  assert.equal(await page.evaluate(() => window.__voiceAudio.filter(a => a.__cueName?.startsWith('expanded-fight-')).every(a => a.paused)), true, 'leaving brief stops its speech');
  await clean();

  await page.goto(origin + '/' + battleHtml);
  await voice('expanded-first-card');
  await click(page.getByRole('button', { name: 'Hide coach tip' }));
  assert.equal(await page.evaluate(() => window.__voiceAudio.every(a => a.paused)), true, 'hiding help stops speech');
  await click(page.getByRole('button', { name: 'Reopen coach tip' }));
  await voice('expanded-first-card');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.evaluate(() => window.__voiceAudio.every(a => a.paused)), true, 'backgrounding pauses speech');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await voice('expanded-first-card');
  const expected = ['expanded-first-district', 'expanded-preview', 'expanded-end-turn',
    'expanded-next-card', 'expanded-spread', 'expanded-preview', 'expanded-end-turn',
    'expanded-bank', 'expanded-fade-card', 'expanded-fade-squabble',
    'expanded-fade-district', 'expanded-fade-play', 'expanded-fade-end-turn'];
  await clickCoach();
  for (const id of expected) { await voice(id); await clickCoach(); }
  await page.getByTestId('battle-result-screen').waitFor();
  await voice('expanded-result');
  await click(page.getByTestId('button-complete-tutorial'));
  await page.getByTestId('rookie-post-fight-handoff').waitFor();
  await voice('expanded-handoff');
  assert.equal(await page.evaluate(() => window.__voiceAudio.filter(a => !a.paused).length), 1, 'result voice stopped before handoff');
  await clean();
  await page.goto(origin + '/e2e/rookie-journey.fixture.html?reward');
  await page.getByTestId('rookie-reward-primer').waitFor();
  await voice('expanded-reward');
  await finishVoice(); await voice('expanded-primer');
  await finishVoice(); await voice('expanded-next');
  await clean();
  console.log(`${width}px ${aac ? 'AAC' : 'Ogg'}: welcome, ${homeLessons.length} tour steps, deck, fight brief, four battle rounds, result and handoff; natural ending, mute, background, reopen, no overlap passed.`);
  await page.close();
}

try {
  await verify(1440, false);
  await verify(390, true);
} finally {
  await browser.close();
  await Promise.all([unlink(battleFile), unlink(battleHtml)]);
}
