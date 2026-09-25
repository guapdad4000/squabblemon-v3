import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { playTutorialSequence, tutorialClipsForText, tutorialScript } from './tutorialVoice';
import clips from './tutorialVoiceClips.json';
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
  assert.deepEqual(tutorialClipsForText('Tap THE TRAP. Dr. Fade fights here while helping an ally in another district. Watch both scores.'), ['generic-fade-district']);
  assert.deepEqual(tutorialClipsForText('A new unrecorded mechanic.'), []);
  assert.deepEqual(tutorialClipsForText(tutorialScript('welcome', 'welcome-reassurance')), ['welcome', 'welcome-reassurance']);
});

test('sequences advance, duck music, and stop completely when a new prompt takes over', async t => {
  const e = environment(t);
  const oldStop = playTutorialSequence(['welcome', 'welcome-reassurance']);
  await settle();
  assert.equal(e.ducks.at(-1), true);
  e.instances[0].end(); await settle();
  assert.match(e.instances[1].src, /welcome-reassurance\.ogg$/);
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
  assert.match(audio.src, /home-1\.m4a$/);
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
  const stop = playTutorialSequence(['home-2']);
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
