import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer, MUSIC_STORAGE_KEY, readMusicPreferences, soundtrack, type MusicSnapshot } from './musicPlayer';

class FakeAudio extends EventTarget {
  src = ''; preload = ''; volume = 1; paused = true; currentTime = 0;
  plays = 0; pauses = 0; loads = 0; supportsOgg = true;
  playResult: (() => Promise<void>) | undefined;
  canPlayType() { return this.supportsOgg ? 'probably' : ''; }
  play() {
    this.plays++;
    if (this.playResult) return this.playResult();
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }
  pause() { this.pauses++; this.paused = true; this.dispatchEvent(new Event('pause')); }
  load() { this.loads++; }
  removeAttribute() { this.src = ''; }
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function setup(audio = new FakeAudio()) {
  let state: MusicSnapshot;
  const saved: unknown[] = [];
  const player = new MusicPlayer(audio as unknown as HTMLAudioElement, {
    assetUrl: path => `/squabblemon/${path}`,
    publish: next => { state = next; },
    save: next => saved.push(next),
  });
  player.setEnvironment(true, true, true);
  return { player, audio, saved, get state() { return state; } };
}

test('does not fetch or play before a gesture, then advances all six tracks and wraps', async () => {
  const s = setup();
  assert.equal(s.audio.src, ''); assert.equal(s.audio.plays, 0);
  s.player.unlock(); await settle();
  for (let index = 0; index < soundtrack.length; index++) {
    assert.equal(s.state.trackIndex, index);
    assert.equal(s.audio.src, `/squabblemon/${soundtrack[index].ogg}`);
    assert.equal(s.state.playing, true);
    s.audio.dispatchEvent(new Event('ended')); await settle();
  }
  assert.equal(s.state.trackIndex, 0);
  s.player.dispose();
});

test('master mute, hidden tab, and leaving game pause and resume the same track', async () => {
  const s = setup(); s.player.unlock(); await settle(); s.audio.currentTime = 37;
  for (const environment of [[true, true, false], [true, false, true], [false, true, true]]) {
    s.player.setEnvironment(...environment as [boolean, boolean, boolean]);
    assert.equal(s.audio.paused, true); assert.equal(s.state.playing, false);
    s.player.unlock(); assert.equal(s.audio.paused, true);
    s.player.setEnvironment(true, true, true); await settle();
    assert.equal(s.audio.paused, false); assert.equal(s.audio.currentTime, 37);
  }
  s.player.setEnabled(false);
  s.player.setEnvironment(true, false, true); s.player.setEnvironment(true, true, true);
  assert.equal(s.audio.paused, true);
  s.player.dispose();
});

test('a late play promise cannot resurrect music after a mute or disposal', async () => {
  const s = setup(); let finish!: () => void;
  s.audio.playResult = () => new Promise(resolve => { finish = resolve; });
  s.player.unlock(); s.player.setEnabled(false);
  s.audio.paused = false; finish(); await settle();
  assert.equal(s.audio.paused, true); assert.equal(s.state.playing, false);
  s.player.setEnabled(true); s.player.dispose();
  s.audio.paused = false; finish(); await settle();
  assert.equal(s.audio.paused, true); assert.equal(s.audio.src, '');
});

test('repeated gestures never start duplicate playback while a play is pending', async () => {
  const s = setup(); let finish!: () => void;
  s.audio.playResult = () => new Promise(resolve => { finish = resolve; });
  for (let i = 0; i < 10; i++) s.player.unlock();
  assert.equal(s.audio.plays, 1); finish(); await settle(); s.player.dispose();
});

test('volume and pause persist without changing track; selecting while paused stays paused', async () => {
  const s = setup(); s.player.unlock(); await settle();
  s.player.setVolume(0.12); assert.equal(s.audio.volume, 0.12);
  s.player.setVolume(-1); assert.equal(s.state.volume, 0);
  s.player.setVolume(Infinity); assert.equal(s.state.volume, 0);
  s.player.setVolume(2); assert.equal(s.state.volume, 1);
  s.player.setEnabled(false); s.player.selectTrack(3);
  assert.equal(s.state.trackIndex, 3); assert.equal(s.audio.paused, true);
  s.player.setEnabled(true); await settle();
  assert.equal(s.audio.src, `/squabblemon/${soundtrack[3].ogg}`);
  assert.ok(s.saved.length >= 5); s.player.dispose();
});

test('uses AAC when OGG is unsupported, and falls back to AAC on an OGG load error', async () => {
  const audio = new FakeAudio(); audio.supportsOgg = false;
  const s = setup(audio); s.player.unlock(); await settle();
  assert.ok(audio.src.endsWith('.m4a')); s.player.dispose();
  const fallback = setup(); fallback.player.unlock(); await settle();
  fallback.audio.dispatchEvent(new Event('error')); await settle();
  assert.ok(fallback.audio.src.endsWith('.m4a')); assert.equal(fallback.state.trackIndex, 0);
  fallback.player.dispose();
});

test('broken assets stop after one bounded playlist pass and can be retried', async () => {
  const s = setup(); s.player.unlock(); await settle();
  for (let i = 0; i < soundtrack.length * 2; i++) {
    s.audio.dispatchEvent(new Event('error')); await settle();
  }
  assert.match(s.state.error!, /could not load/);
  assert.equal(s.audio.paused, true);
  const plays = s.audio.plays;
  for (let i = 0; i < 5; i++) { s.player.unlock(); s.audio.dispatchEvent(new Event('error')); }
  assert.equal(s.audio.plays, plays);
  s.player.setEnabled(true); await settle();
  assert.equal(s.state.error, null); assert.equal(s.state.playing, true);
  s.player.dispose();
});

test('autoplay denial can be recovered by the next gesture without an unhandled rejection', async () => {
  const s = setup();
  s.audio.playResult = () => Promise.reject(new DOMException('Tap required', 'NotAllowedError'));
  s.player.unlock(); await settle();
  assert.equal(s.state.blocked, true); assert.equal(s.state.playing, false);
  s.audio.playResult = undefined; s.player.unlock(); await settle();
  assert.equal(s.state.blocked, false); assert.equal(s.state.playing, true); s.player.dispose();
});

test('disposal removes listeners and unloads media so later events cannot restart it', async () => {
  const s = setup(); s.player.unlock(); await settle(); s.player.dispose();
  const plays = s.audio.plays;
  for (const type of ['ended', 'playing', 'error']) s.audio.dispatchEvent(new Event(type));
  s.player.unlock(); assert.equal(s.audio.plays, plays); assert.equal(s.audio.loads, 1);
});

test('saved music preferences validate malformed and out-of-range values', () => {
  const read = (value: string) => readMusicPreferences({ getItem: key => { assert.equal(key, MUSIC_STORAGE_KEY); return value; } });
  assert.deepEqual(read('{"enabled":false,"volume":0.5,"trackIndex":3}'), { enabled: false, volume: 0.5, trackIndex: 3 });
  assert.equal(read('{"trackIndex":100,"volume":-1}').trackIndex, 0);
  assert.equal(read('{"trackIndex":100,"volume":-1}').volume, 0);
  assert.equal(read('invalid').enabled, true); assert.equal(read('null').enabled, true);
});


test('Web Audio controls music volume and reconnects playback after context suspension', async () => {
  const audio = new FakeAudio();
  const volumes: number[] = [];
  let created = 0, disconnected = 0, closed = 0, resumed = 0;
  const context = {
    state: 'suspended', currentTime: 0, destination: {},
    createGain: () => ({ connect() {}, disconnect() { disconnected++; }, gain: {
      setValueAtTime(value: number) { volumes.push(value); },
      setTargetAtTime(value: number) { volumes.push(value); },
    } }),
    createMediaElementSource: () => { created++; return { connect() {}, disconnect() { disconnected++; } }; },
    resume: async () => { resumed++; context.state = 'running'; },
    close: async () => { closed++; },
  };
  const player = new MusicPlayer(audio as unknown as HTMLAudioElement, {
    assetUrl: path => path, publish: () => {}, createContext: () => context as unknown as AudioContext,
  });
  player.setEnvironment(true, true, true); player.unlock(); await settle();
  player.setVolume(0.13);
  assert.equal(audio.volume, 1, 'gain handles volume on browsers that ignore media volume');
  assert.equal(volumes.at(-1), 0.13);
  player.next(); await settle(); assert.equal(created, 1, 'track changes reuse the connected audio source');
  context.state = 'suspended'; player.unlock(); await settle();
  assert.equal(context.state, 'running'); assert.ok(resumed >= 2);
  player.dispose(); assert.equal(disconnected, 2); assert.equal(closed, 1);
});
