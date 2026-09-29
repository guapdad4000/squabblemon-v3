import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { playTutorialSequence, rookieRoadCues, tutorialClipsForText, tutorialScript } from './tutorialVoice';
import clips from './tutorialVoiceClips.json';
import manifest from '../../reference/dr-fade-tutorial-audio.json';
import { MECHANIC_LESSONS } from '../components/tutorialGuidance';
import tour from './safehouseTour.json';
import pickups from '../../reference/dr-fade-tutorial-recording-updates.json';
import { FEEDBACK_CHANGE_EVENT } from '../battleFeedback';
import { attachMusicPlayer } from '../musicStore';
import type { MusicPlayer } from '../musicPlayer';

const settle = () => new Promise(resolve => setImmediate(resolve));

function environment(t: Parameters<Parameters<typeof test>[1]>[0], ogg = true) {
  const instances: FakeAudio[] = [];
  const ducks: boolean[] = [];
  const document = Object.assign(new EventTarget(), { hidden: false, createElement: () => ({ canPlayType: () => ogg ? 'probably' : '' }) });
  const window = new EventTarget();
  class FakeAudio {
    paused = true; currentTime = 0; volume = 1; preload = ''; plays = 0;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public src: string) { instances.push(this); }
    play() { this.plays++; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
    load() {}
    end() { this.paused = true; this.onended?.(); }
  }
  for (const [key, value] of Object.entries({ window, document, Audio: FakeAudio, localStorage: { getItem: () => null } })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
  attachMusicPlayer({ setDucked: (value: boolean) => ducks.push(value) } as MusicPlayer);
  t.after(() => { playTutorialSequence([]); attachMusicPlayer(null); });
  const mute = (enabled: boolean) => window.dispatchEvent(new CustomEvent(FEEDBACK_CHANGE_EVENT, { detail: { audioEnabled: enabled, hapticsEnabled: false } }));
  return { instances, ducks, document, window, mute, FakeAudio };
}

test('all supplied lines have audio assets and alternate cards/costs cannot announce the wrong recording', () => {
  for (const clip of clips) {
    assert.ok(tutorialClipsForText(clip.text).length, clip.id);
    for (const extension of ['ogg', 'm4a']) assert.ok(existsSync(new URL(`../../public/audio/voice/dr-fade/tutorial/${clip.id}.${extension}`, import.meta.url)), clip.id);
  }
  assert.deepEqual(tutorialClipsForText('Tap Tin Man. It costs 4 Motion in our target district. Hands is the strength it adds to your side.'), ['generic-card']);
  assert.deepEqual(tutorialClipsForText('Tap ANOTHER DISTRICT. Dr. Fade fights here while helping an ally in another district. Watch both scores.'), ['generic-fade-district']);
  assert.deepEqual(tutorialClipsForText('A new unrecorded mechanic.'), []);
  assert.deepEqual(tutorialClipsForText(tutorialScript('welcome', 'welcome-reassurance')), ['welcome', 'welcome-reassurance']);
});

test('expanded recording sections decode completely in desktop Ogg and phone AAC', () => {
  for (const take of manifest.clips.filter(clip => clip.source === 'expanded')) {
    const duration = take.end - take.start;
    const metadata = clips.find(clip => clip.id === take.id)!;
    assert.ok(metadata, take.id);
    for (const extension of ['ogg', 'm4a']) {
      const file = new URL(`../../public/audio/voice/dr-fade/tutorial/${take.id}.${extension}`, import.meta.url);
      const decoded = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file.pathname], { encoding: 'utf8' }).trim());
      assert.ok(Math.abs(decoded - duration) < .22, `${take.id}.${extension}: ${decoded}s vs ${duration}s`);
      execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', file.pathname, '-f', 'null', '-'], { stdio: 'pipe' });
    }
  }
});

test('stable Rookie Road context routes only truthful cues; missing coverage stays written', () => {
  assert.deepEqual(rookieRoadCues('home-5'), ['expanded-home-gang']);
  for (const id of ['r1_choose_card', 'r2_choose_card', 'r1_choose_district', 'r2_choose_district', 'r1_play_card', 'r2_play_card', 'r3_bank_motion']) {
    assert.ok(rookieRoadCues(id).every(cue => cue.startsWith('expanded-')), id);
  }
  assert.deepEqual(rookieRoadCues('r3_bank_motion', { cardSelected: true }), ['expanded-clear-card']);
  assert.deepEqual(rookieRoadCues('r4_choose_card', { fadeHighlighted: false }), []);
  assert.deepEqual(rookieRoadCues('r4_choose_district', { fadeHighlighted: false }), []);
  assert.deepEqual(rookieRoadCues('r4_choose_district', { fadeHighlighted: true }), ['expanded-fade-district']);
  assert.deepEqual(rookieRoadCues('r4_end_turn', { squabbleThisRound: false }), ['expanded-end-turn']);
  assert.deepEqual(rookieRoadCues('result'), ['expanded-result']);
  assert.deepEqual(rookieRoadCues('handoff'), ['expanded-handoff']);
  assert.deepEqual(rookieRoadCues('unrecorded-reward-total'), []);
  assert.deepEqual(tutorialClipsForText('Tap another card. It costs 7 Motion in THE TRAP.'), []);
});

test('sequences advance, duck music, and stop completely when a new prompt takes over', async t => {
  const e = environment(t);
  const oldStop = playTutorialSequence(['welcome', 'welcome-reassurance']);
  await settle();
  assert.equal(e.ducks.at(-1), true);
  e.instances[0].end(); await settle();
  assert.match(e.instances[1].src, /welcome-reassurance\.ogg\?v=[a-f0-9]+$/);
  const stop = playTutorialSequence(['home-1']); await settle();
  assert.equal(e.instances[1].paused, true);
  oldStop();
  assert.equal(e.instances[2].paused, false, 'old component cleanup cannot kill the new prompt');
  stop();
  assert.equal(e.instances[2].paused, true);
  assert.equal(e.ducks.at(-1), false);
  e.document.dispatchEvent(new Event('pointerup')); await settle();
  assert.equal(e.instances.length, 3, 'no stale listeners restart cancelled speech');
});

test('mute and backgrounding pause speech and resume the same clip, with AAC fallback', async t => {
  const e = environment(t, false);
  playTutorialSequence(['home-1']); await settle();
  const audio = e.instances[0];
  assert.match(audio.src, /home-1\.m4a\?v=[a-f0-9]+$/);
  audio.currentTime = 2;
  e.mute(false);
  assert.equal(audio.paused, true);
  e.document.dispatchEvent(new Event('pointerup')); await settle();
  assert.equal(audio.paused, true);
  e.mute(true); await settle();
  assert.equal(audio.currentTime, 2);
  assert.equal(audio.paused, false);
  e.document.hidden = true; e.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(audio.paused, true);
  e.document.hidden = false; e.document.dispatchEvent(new Event('visibilitychange')); await settle();
  assert.equal(audio.paused, false);
  audio.end(); await settle();
  assert.equal(e.ducks.at(-1), false);
});

test('autoplay denial retries on a gesture; a late play resolution cannot resurrect an old cue', async t => {
  const e = environment(t);
  const originalPlay = e.FakeAudio.prototype.play;
  e.FakeAudio.prototype.play = function () { this.plays++; return Promise.reject(new DOMException('Gesture required', 'NotAllowedError')); };
  playTutorialSequence(['home-1']); await settle();
  assert.equal(e.instances[0].paused, true);
  e.FakeAudio.prototype.play = originalPlay;
  e.document.dispatchEvent(new Event('pointerup')); await settle();
  assert.equal(e.instances[0].paused, false);
  let resolve!: () => void;
  e.FakeAudio.prototype.play = function () { return new Promise<void>(done => { resolve = done; }); };
  const stop = playTutorialSequence(['home-story-left']);
  const pending = e.instances[1];
  stop(); pending.paused = false; resolve(); await settle();
  assert.equal(pending.paused, true);
  assert.equal(e.ducks.at(-1), false);
});

test('failed clips advance without trapping the lesson or leaving music quiet', async t => {
  const e = environment(t);
  playTutorialSequence(['welcome', 'welcome-reassurance']); await settle();
  e.instances[0].onerror?.(); await settle();
  assert.match(e.instances[1].src, /welcome-reassurance/);
  e.instances[1].onerror?.(); await settle();
  assert.equal(e.ducks.at(-1), false);
});


test('every tour stop and revised card prompt has its exact recording', () => {
  for (const cue of [...tour.filter(step => step.id !== 'home-5').map(step => ({ id: step.id, text: step.body })), ...pickups]) {
    assert.deepEqual(tutorialClipsForText(cue.text), [cue.id]);
    assert.match(clips.find(clip => clip.id === cue.id)!.revision, /^[a-f0-9]{12}$/);
  }
  assert.ok(clips.every(clip => !/Alice|Tin Man|Scarecrow/.test(clip.text)));
  assert.deepEqual(tutorialClipsForText(tour.find(step => step.id === 'home-5')!.body), [], 'revised draw order must not play the older Gang take');
});

test('every first-sighting mechanic still maps its displayed explanation to a dedicated recording', () => {
  for (const lesson of Object.values(MECHANIC_LESSONS)) {
    assert.deepEqual(tutorialClipsForText(`${lesson.summary} ${lesson.tacticalTip}`), [`mechanic-${lesson.id}`]);
  }
});
