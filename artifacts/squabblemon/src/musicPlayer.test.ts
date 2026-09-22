import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('does not fetch or play before a gesture, then advances the full catalog and wraps', async () => {
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

test('mode playlists rotate locally, obey muted preferences, and restore the background selection', async () => {
  const { modeSoundtracks } = await import('./musicModes');
  const s = setup(); s.player.unlock(); await settle();
  s.player.selectTrack(3); await settle();
  const background = { enabled:true, volume:.2, trackIndex:3 };
  s.player.setPlaylist(modeSoundtracks.story, { enabled:true, volume:.4, trackIndex:0 }); await settle();
  assert(s.audio.src.endsWith('story-music.ogg'));
  s.audio.dispatchEvent(new Event('ended')); await settle(); assert(s.audio.src.endsWith('story-music-3.ogg'));
  s.audio.dispatchEvent(new Event('ended')); await settle(); assert(s.audio.src.endsWith('story-music.ogg'));
  s.player.setPlaylist(modeSoundtracks.boss, { enabled:false, volume:.4, trackIndex:0 }); await settle();
  assert.equal(s.audio.paused,true);
  s.player.setPlaylist(soundtrack,background); await settle();
  assert.equal(s.state.trackIndex,3); assert.equal(s.audio.volume,.2); assert.equal(s.audio.paused,false);
  s.player.dispose();
});

test('routes choose ranked battle, story, boss, training, gacha, and background music', async () => {
  const { activeMusicMode, musicModeForRoute } = await import('./musicModes');
  assert.equal(musicModeForRoute('/game'),'background');
  assert.equal(musicModeForRoute('/game/story'),'story');
  assert.equal(musicModeForRoute('/game/play'),'training');
  assert.equal(musicModeForRoute('/game/online'),'battle');
  assert.equal(musicModeForRoute('/game/online/ABCD12'),'battle');
  assert.equal(musicModeForRoute('/game/shop'),'gacha');
  assert.equal(musicModeForRoute('/game/shop?view=packs'),'gacha');
  assert.equal(musicModeForRoute('/game/shop?view=training'),'training');
  assert.equal(musicModeForRoute('/game/shop?view=corner'),'background');
  assert.equal(musicModeForRoute('/game/story/play/welcome-to-the-block'),'story');
  const { storyContent } = await import('@workspace/squabblemon-engine/story');
  const boss=storyContent.chapters.flatMap(chapter=>chapter.nodes).find(node=>node.kind==='battle' && node.battleType==='boss');
  assert(boss); assert.equal(musicModeForRoute(`/game/story/play/${boss.id}`),'boss');
  assert.equal(activeMusicMode('/game/online', 'defeat'), 'battle', 'Fade Park ignores a stale result override');
  assert.equal(activeMusicMode('/game/online?tab=friends', 'victory'), 'battle', 'friend lobby ignores a stale result override');
  assert.equal(activeMusicMode('/game/online/ABCD12', 'victory'), 'victory');
  assert.equal(activeMusicMode('/game/online/ABCD12', null), 'battle', 'clearing a result override restores the route playlist');
  assert.equal(activeMusicMode('/game/story/play/welcome-to-the-block', 'defeat'), 'defeat');
  assert.equal(activeMusicMode('/game/story/play/welcome-to-the-block', null), 'story');
});

test('catalog preserves the original records and adds each unique uploaded battle track once', () => {
  assert.deepEqual(soundtrack.slice(0, 6).map(track => track.id), [
    'wax-killa-breaks', 'grime-of-the-temple', 'chop-block', 'shaolin-scratches', 'saber-chop', 'shaolin-static',
  ]);
  assert.deepEqual(soundtrack.slice(6).map(track => track.id), [
    'battle-music', 'squabblemon-battle-2', 'track-1-take-2', 'track-1', 'track-1-take-3',
    'track-1-wav-master', 'squabblemon-win', 'win-music', 'squabblemon-loss', 'story-music', 'story-music-3',
    'weird-kids-can-fight-too', 'tooth-punch-fruit-punch', 'swirling-fists-in-a-pain-tornado', 'huge-aura',
  ]);
  assert.equal(new Set(soundtrack.map(track => track.id)).size, soundtrack.length);
  assert.equal(new Set(soundtrack.map(track => track.sourceSha256)).size, soundtrack.length);
});

test('battle modes retain the original six tracks alongside six non-outcome uploads', async () => {
  const { battleSoundtrack, modeSoundtracks } = await import('./musicModes');
  const originalIds = [
    'wax-killa-breaks', 'grime-of-the-temple', 'chop-block', 'shaolin-scratches', 'saber-chop', 'shaolin-static',
  ];
  assert.deepEqual(battleSoundtrack.map(track => track.id), [
    'battle-music', 'squabblemon-battle-2', 'track-1-take-2', 'track-1', 'track-1-take-3', 'track-1-wav-master',
    ...originalIds,
  ]);
  assert.deepEqual(modeSoundtracks.training.map(track => track.id), ['training-ost']);
  assert.deepEqual(modeSoundtracks.story.map(track => track.id), ['story-music', 'story-music-3']);
  assert.deepEqual(modeSoundtracks.boss.map(track => track.id), ['boss-fight-ost']);
  for (const playlist of [modeSoundtracks.battle, modeSoundtracks.training, modeSoundtracks.story, modeSoundtracks.boss]) {
    assert.equal(playlist.some(track => ['squabblemon-win', 'win-music', 'squabblemon-loss'].includes(track.id)), false);
  }
});

test('result playlists use only their dedicated cues', async () => {
  const { outcomeSoundtracks } = await import('./musicModes');
  assert.deepEqual(outcomeSoundtracks.victory.map(track => track.id), ['squabblemon-win', 'win-music']);
  assert.deepEqual(outcomeSoundtracks.defeat.map(track => track.id), ['squabblemon-loss']);
  const s = setup();
  s.player.setPlaylist(outcomeSoundtracks.victory, { enabled: true, volume: .24, trackIndex: 0 });
  assert.equal(s.audio.plays, 0);
  assert.equal(s.audio.src, '');
  s.player.unlock(); await settle();
  assert(s.audio.src.endsWith('/audio/treblo/squabblemon-win.ogg'));
  s.audio.dispatchEvent(new Event('ended')); await settle();
  assert(s.audio.src.endsWith('/audio/treblo/win-music.ogg'));
  s.player.setPlaylist(outcomeSoundtracks.defeat, { enabled: true, volume: .24, trackIndex: 0 }); await settle();
  assert(s.audio.src.endsWith('/audio/treblo/squabblemon-loss.ogg'));
  const { modeSoundtracks } = await import('./musicModes');
  s.player.setPlaylist(modeSoundtracks.story, { enabled: true, volume: .4, trackIndex: 0 }); await settle();
  assert(s.audio.src.endsWith('/audio/treblo/story-music.ogg'), 'leaving a result restores the active route mode');
  s.player.dispose();
});

test('every original catalog ID remains selectable and playable in the battle queue', async () => {
  const { battleSoundtrack, outcomeSoundtracks } = await import('./musicModes');
  const originalIds = [
    'wax-killa-breaks', 'grime-of-the-temple', 'chop-block', 'shaolin-scratches', 'saber-chop', 'shaolin-static',
  ];
  assert.equal(soundtrack.length, 21);
  for (const playlist of [battleSoundtrack]) {
    const s = setup();
    s.player.setPlaylist(playlist, { enabled: true, volume: .24, trackIndex: 0 });
    s.player.unlock(); await settle();
    for (const id of originalIds) {
      const index = playlist.findIndex(track => track.id === id);
      assert.notEqual(index, -1, `${id} must remain selectable`);
      s.player.selectTrack(index); await settle();
      assert.equal(s.state.track?.id, id);
      assert(s.audio.src.endsWith(`/audio/treblo/${id}.ogg`), `${id} must load its shipped audio`);
    }
    s.player.dispose();
  }
});

test('catalog, result, and transparent DJ assets ship in web formats without the source WAV', async () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
  const { outcomeSoundtracks } = await import('./musicModes');
  const tracks = [...soundtrack, ...outcomeSoundtracks.victory, ...outcomeSoundtracks.defeat];
  for (const track of tracks) {
    for (const path of [track.ogg, track.aac]) assert(statSync(join(root, path)).size > 1_000);
  }
  assert.equal(readdirSync(join(root, 'audio', 'treblo')).some(file => file.endsWith('.wav')), false);
  const artwork = readFileSync(join(root, 'assets', 'generated', 'dr-fade-dj-turntable.png'));
  assert.equal(artwork.subarray(1, 4).toString('ascii'), 'PNG');
});
