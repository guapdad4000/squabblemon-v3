import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { BattleAnnouncementDirector, createBattleAnnouncer, type AnnouncementState, type BattleAnnouncement } from './battleAnnouncer';
import { ANNOUNCER_VOLUME_KEY, getAnnouncerVolume, setAnnouncerVolume } from './battleAnnouncerVolume';
import { FEEDBACK_CHANGE_EVENT, FEEDBACK_STORAGE_KEY } from '../battleFeedback';

const state = (patch: Partial<AnnouncementState> = {}): AnnouncementState => ({ round: 1, roundLimit: 6, active: true, roundReady: true, yourTurn: true, ...patch });
const tick = () => new Promise(resolve => setImmediate(resolve));
function timeline() {
  const calls: { cue: BattleAnnouncement; done: () => void; stopped: boolean }[] = [];
  const director = new BattleAnnouncementDirector((cue, done) => {
    const call = { cue, done, stopped: false };
    calls.push(call);
    return () => { call.stopped = true; };
  });
  return { calls, director };
}

test('round then your turn once; card resolution, reconnect, and replay do not repeat them', () => {
  const { calls, director } = timeline();
  director.update(state({ roundReady: false, yourTurn: false }));
  assert.equal(calls.length, 0);
  director.update(state({ yourTurn: false }));
  director.update(state());
  assert.deepEqual(calls.map(c => c.cue), ['round-1']);
  calls[0].done();
  assert.equal(calls[1].cue, 'your-turn-1');
  calls[1].done();
  for (let i = 0; i < 3; i++) {
    director.update(state({ yourTurn: false }));
    director.update(state());
    director.update(state({ active: false }));
    director.update(state());
  }
  assert.equal(calls.length, 2);
  director.update(state({ round: 2 }));
  calls[2].done();
  calls[3].done();
  director.update(state({ round: 1, active: false }));
  director.update(state({ round: 2 }));
  assert.deepEqual(calls.map(c => c.cue), ['round-1', 'your-turn-1', 'round-2', 'your-turn-2']);
});

test('online rival-first rounds wait for your seat before announcing your turn', () => {
  const { calls, director } = timeline();
  director.update(state({ yourTurn: false }));
  calls[0].done();
  assert.equal(calls.length, 1);
  director.update(state());
  assert.equal(calls[1].cue, 'your-turn-1');
  calls[1].done();
  director.update(state({ round: 2, yourTurn: false }));
  calls[2].done();
  director.update(state({ round: 2 }));
  assert.equal(calls[3].cue, 'your-turn-2');
});

test('the solo final-round take follows the actual round limit in short and standard battles', () => {
  for (const roundLimit of [1, 4, 5, 6]) {
    const { calls, director } = timeline();
    director.update(state({ round: roundLimit, roundLimit }));
    assert.equal(calls[0].cue, 'final-round');
    assert.equal(calls.length, 1, 'your-turn waits for the entire final-round line');
    calls[0].done();
    assert.equal(calls[1].cue, `your-turn-${(roundLimit - 1) % 5 + 1}`);
  }
});

test('passing early drops a queued your-turn and advancing or exiting stops stale audio', () => {
  const { calls, director } = timeline();
  director.update(state());
  director.update(state({ yourTurn: false }));
  calls[0].done();
  assert.equal(calls.length, 1);
  director.update(state({ round: 2 }));
  director.update(state({ round: 3 }));
  assert(calls[1].stopped);
  calls[1].done();
  assert.equal(calls.length, 3);
  director.update(state({ round: 3, active: false }));
  assert(calls[2].stopped);
  calls[2].done();
  assert.equal(calls.length, 3);
});

function environment(t: TestContext, ogg = true) {
  const cleanups: (() => void)[] = [];
  t.after(() => cleanups.forEach(cleanup => cleanup()));
  const instances: FakeAudio[] = [];
  const document = Object.assign(new EventTarget(), { hidden: false, createElement: () => ({ canPlayType: () => ogg ? 'probably' : '' }) });
  const window = new EventTarget();
  const values = new Map([[ANNOUNCER_VOLUME_KEY, '0.9']]);
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
  class FakeAudio extends EventTarget {
    paused = true;
    volume = 1;
    plays = 0;
    preload = '';
    original: string;
    constructor(public src: string) { super(); this.original = src; instances.push(this); }
    play() { this.plays++; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ''; }
    load() {}
    end() { this.paused = true; this.dispatchEvent(new Event('ended')); }
  }
  for (const [key, value] of Object.entries({ window, document, localStorage, Audio: FakeAudio })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
  return { document, window, values, instances, FakeAudio, cleanups };
}

test('all cuts exist as OGG and AAC and final-round exclusively uses the standalone recording', () => {
  const manifest = JSON.parse(readFileSync('reference/battle-announcer.json', 'utf8'));
  assert.equal(manifest.clips.length, 11);
  for (const clip of manifest.clips) {
    for (const extension of ['ogg', 'm4a']) assert(existsSync(`public/audio/voice/dr-fade/battle/${clip.id}.${extension}`));
    assert.equal(clip.source, clip.id === 'final-round' ? 1 : 0);
    if (clip.source === 0) assert(clip.end < 12.68, 'discard the last phrase from the combined recording');
  }
});

test('live announcer volume persists independently; zero stops the channel and clears queued speech', async t => {
  const e = environment(t);
  const channel = createBattleAnnouncer(); e.cleanups.push(channel.dispose);
  channel.update(state());
  await tick();
  assert.equal(e.instances[0].volume, 0.9);
  setAnnouncerVolume(0.31);
  assert.equal(e.instances[0].volume, 0.31);
  assert.equal(e.values.get(ANNOUNCER_VOLUME_KEY), '0.31');
  assert.equal(e.values.has('squabblemon_music_v1'), false);
  setAnnouncerVolume(0);
  assert(e.instances[0].paused);
  e.instances[0].end();
  await tick();
  assert.equal(e.instances.length, 1);
  setAnnouncerVolume(0.6);
  channel.update(state());
  await tick();
  assert.equal(e.instances.length, 1, 'unmuting never repeats past announcements');
  channel.update(state({ round: 2 }));
  assert.equal(e.instances[1].volume, 0.6);
});

test('master mute, backgrounding and disposal stop speech without resurrecting it', async t => {
  const e = environment(t);
  const channel = createBattleAnnouncer(); e.cleanups.push(channel.dispose);
  channel.update(state()); await tick();
  e.values.set(FEEDBACK_STORAGE_KEY, JSON.stringify({ audioEnabled: false }));
  e.window.dispatchEvent(new Event(FEEDBACK_CHANGE_EVENT));
  assert(e.instances[0].paused);
  e.values.set(FEEDBACK_STORAGE_KEY, JSON.stringify({ audioEnabled: true }));
  channel.update(state({ round: 2 })); await tick();
  e.document.hidden = true;
  e.document.dispatchEvent(new Event('visibilitychange'));
  assert(e.instances[1].paused);
  e.document.hidden = false;
  e.document.dispatchEvent(new Event('pointerup'));
  channel.update(state({ round: 3 })); await tick();
  channel.dispose();
  e.document.dispatchEvent(new Event('pointerup'));
  assert(e.instances.every(a => a.paused && a.plays === 1));
  e.instances[2].end(); await tick();
  assert.equal(e.instances.length, 3);
});

test('initial mute skips cues, AAC is used when needed, and media failure does not block your turn', async t => {
  const e = environment(t, false);
  const channel = createBattleAnnouncer(); e.cleanups.push(channel.dispose);
  e.values.set(FEEDBACK_STORAGE_KEY, JSON.stringify({ audioEnabled: false }));
  channel.update(state()); await tick();
  assert.equal(e.instances.length, 0);
  e.values.delete(FEEDBACK_STORAGE_KEY);
  channel.update(state({ round: 2 })); await tick();
  assert.match(e.instances[0].original, /round-2\.m4a$/);
  e.instances[0].dispatchEvent(new Event('error')); await tick();
  assert.match(e.instances[1].original, /your-turn-2\.m4a$/);
});

test('blocked autoplay retries on a gesture, never restarts a finished or abandoned cue', async t => {
  const e = environment(t);
  const nativePlay = e.FakeAudio.prototype.play;
  e.FakeAudio.prototype.play = function () { this.plays++; return Promise.reject(new DOMException('Gesture required', 'NotAllowedError')); };
  const channel = createBattleAnnouncer(); e.cleanups.push(channel.dispose);
  channel.update(state()); await tick();
  e.FakeAudio.prototype.play = nativePlay;
  e.document.dispatchEvent(new Event('pointerup')); await tick();
  assert.equal(e.instances[0].plays, 2);
  e.instances[0].end(); await tick();
  e.document.dispatchEvent(new Event('pointerup')); await tick();
  assert.equal(e.instances[0].plays, 2);
  assert.equal(e.instances[1].plays, 1);
  channel.dispose();
  e.document.dispatchEvent(new Event('pointerup')); await tick();
  assert.equal(e.instances[1].plays, 1);
});

test('stored volume is bounded and invalid input cannot corrupt it', t => {
  const e = environment(t);
  e.values.set(ANNOUNCER_VOLUME_KEY, 'junk'); assert.equal(getAnnouncerVolume(), 0.9);
  setAnnouncerVolume(1.4); assert.equal(getAnnouncerVolume(), 1);
  setAnnouncerVolume(-1); assert.equal(getAnnouncerVolume(), 0);
  setAnnouncerVolume(NaN); assert.equal(getAnnouncerVolume(), 0);
  setAnnouncerVolume(0.9);
});

test('Web Audio gain controls iOS volume and disconnects only voice nodes, never the shared music context', async t => {
  const e = environment(t);
  const gains: { gain: { value: number; setValueAtTime: (value: number) => void }; disconnected: boolean; connect: () => void; disconnect: () => void }[] = [];
  const sources: { disconnected: boolean; connect: () => void; disconnect: () => void }[] = [];
  let closes = 0, suspends = 0;
  class FakeContext {
    state = 'running'; currentTime = 0; destination = {};
    createGain() {
      const node = { gain: { value: 1, setValueAtTime(value: number) { this.value = value; } }, disconnected: false, connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(node); return node;
    }
    createMediaElementSource() { const node = { disconnected: false, connect() {}, disconnect() { this.disconnected = true; } }; sources.push(node); return node; }
    close() { closes++; return Promise.resolve(); }
    suspend() { suspends++; return Promise.resolve(); }
  }
  Object.assign(e.window, { AudioContext: FakeContext });
  const channel = createBattleAnnouncer(); e.cleanups.push(channel.dispose);
  channel.update(state()); await tick();
  assert.equal(e.instances[0].volume, 1);
  assert.equal(gains[0].gain.value, 0.9);
  setAnnouncerVolume(0.27); assert.equal(gains[0].gain.value, 0.27);
  e.instances[0].end(); await tick();
  assert(gains[0].disconnected && sources[0].disconnected);
  assert.equal(gains[1].gain.value, 0.27);
  channel.dispose();
  assert(gains[1].disconnected && sources[1].disconnected);
  assert.equal(closes, 0); assert.equal(suspends, 0);
});
