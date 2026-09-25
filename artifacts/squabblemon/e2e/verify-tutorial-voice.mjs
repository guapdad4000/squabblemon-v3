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
  await page.route('**/scenes/**', route => route.abort());
  await page.addInitScript(forceAac => {
    window.__voiceAudio = [];
    window.__voicePlayed = [];
    window.__voiceErrors = [];
    window.__voiceOverlap = false;
    if (forceAac) {
      const canPlayType = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function (type) { return type.includes('vorbis') ? '' : canPlayType.call(this, type); };
    }
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src) {
        super(src);
        if (!src?.includes('/dr-fade/tutorial/')) return;
        window.__voiceAudio.push(this);
        this.addEventListener('playing', () => {
          window.__voicePlayed.push(src.split('/').at(-1));
          if (window.__voiceAudio.filter(a => !a.paused && !a.ended).length > 1) window.__voiceOverlap = true;
        });
        this.addEventListener('error', () => window.__voiceErrors.push({ src, code: this.error?.code }));
      }
    };
  }, aac);
  const voice = async id => {
    try {
      const candidates = (Array.isArray(id) ? id : [id]).map(value => value + (aac ? '.m4a' : '.ogg'));
      await page.waitForFunction(expected => window.__voiceAudio.some(a => expected.some(name => a.src.endsWith(name)) && !a.paused && a.readyState >= 2), candidates, { timeout: 10000 });
    } catch (error) {
      const state = await page.evaluate(() => ({ text: document.querySelector('.fade-tip')?.textContent, played: window.__voicePlayed, audio: window.__voiceAudio.map(a => ({ src: a.src, paused: a.paused, ready: a.readyState, time: a.currentTime })), errors: window.__voiceErrors }));
      throw new Error(`Expected ${id}: ${JSON.stringify(state)}; ${error.message}`);
    }
  };
  const finishVoice = () => page.evaluate(() => {
    const audio = window.__voiceAudio.find(a => !a.paused && !a.ended);
    if (audio) audio.currentTime = Math.max(0, audio.duration - .03);
  });
  const click = locator => width < 600 ? locator.first().tap() : locator.first().click();
  const clickCoach = async () => {
    const panel = page.getByTestId('fade-spotlight');
    const buttons = panel.getByRole('button');
    if (await buttons.count()) return click(buttons);
    const target = await panel.getAttribute('data-coach-target');
    if (target === '.safehouse-room-actions') return click(page.getByRole('button', { name: 'Build your gang', exact: true }));
    return click(page.locator(target));
  };
  const clean = async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.__voiceErrors), []);
    assert.equal(await page.evaluate(() => window.__voiceOverlap), false);
  };

  await page.goto(origin + '/e2e/rookie-journey.fixture.html');
  await voice('welcome');
  await finishVoice(); await voice('welcome-reassurance');
  await click(page.getByRole('button', { name: 'Show me around' }));
  for (const step of homeLessons) {
    const recording = recordedClips.find(clip => clip.text === step.body);
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
  await voice('deck-1'); await clickCoach();
  await voice('deck-2'); await clickCoach();
  await voice('deck-3');
  await clean();

  await page.goto(origin + '/' + battleHtml);
  const expected = [['r1_choose_card', 'generic-card'], ['r1_choose_district', 'generic-district'], 'r1_play_card', 'r1_end_turn', ['r2_choose_card', 'generic-card'], 'r2_choose_district', 'r1_play_card', 'r1_end_turn', 'r3_bank_motion', 'r4_choose_card', 'r4_arm_squabble', ['r4_choose_district', 'generic-fade-district'], 'r4_play_squabble', 'r1_end_turn'];
  for (const id of expected) { await voice(id); await clickCoach(); }
  await page.getByTestId('tutorial-done').waitFor();
  assert.equal(await page.evaluate(() => window.__voiceAudio.every(a => a.paused)), true, 'completion stops battle prompts');
  await clean();
  console.log(`${width}px ${aac ? 'AAC' : 'Ogg'}: welcome, ${homeLessons.length} tour steps, legendary queue, deck swap, all four battle rounds, mute, no overlap, and clean completion passed.`);
  await page.close();
}

try {
  await verify(1440, false);
  await verify(390, true);
} finally {
  await browser.close();
  await Promise.all([unlink(battleFile), unlink(battleHtml)]);
}
