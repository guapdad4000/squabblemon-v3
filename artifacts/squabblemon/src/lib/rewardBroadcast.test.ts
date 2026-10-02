import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rewardClips, loadingScenes } from './broadcastCatalog';
import { selectRewardClip } from './rewardBroadcast';
import { canPlayOptionalBroadcast } from './optionalBroadcastMedia';

test('the zero-module first paint mirrors the three scene IDs, files and framing', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('loading-scenes.webp'));
  assert.ok(!html.includes('loading-scenes.webm'));
  assert.match(html, /dataset\.bootLoadingScene/);
  for (const scene of loadingScenes) {
    assert.ok(html.includes(scene.id));
    assert.ok(html.includes(scene.poster.split('/').at(-1)!.replace('.jpg', '')));
    assert.ok(html.includes(scene.portraitPosition));
    assert.ok(html.includes(scene.landscapePosition));
  }
});

test('each shipped cut has a reachable outcome pool, no original source URL, and a short duration', () => {
  assert.equal(loadingScenes.length, 3);
  const ids = new Set<string>();
  for (const clip of rewardClips) {
    assert.ok(!ids.has(clip.id));
    ids.add(clip.id);
    assert.ok(clip.duration >= 1 && clip.duration <= 3);
    assert.ok(clip.tags.length);
    assert.match(clip.video, /^brand\/broadcast\/rewards\/[^/]+\.mp4$/);
    assert.match(clip.poster, /^brand\/broadcast\/rewards\/[^/]+\.(jpg|webp)$/);
  }
  for (const tag of ['victory', 'defeat', 'draw', 'reward'] as const) {
    assert.ok(rewardClips.filter(clip => clip.tags.includes(tag)).length >= 2, `varied ${tag} pool required`);
    let previous = '';
    for (let index = 0; index < 60; index++) {
      const clip = selectRewardClip(tag)!;
      assert.ok(clip.tags.includes(tag));
      assert.notEqual(clip.id, previous);
      previous = clip.id;
    }
  }
});

test('optional broadcasts request no media for accessibility, hidden tabs or constrained networks', () => {
  const originals = ['window', 'navigator', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const state = { reduced: false, hidden: false, profileReduced: 'false', connection: {} as Record<string, unknown> };
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: state.reduced }) } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get connection() { return state.connection; } } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
      get hidden() { return state.hidden; },
      documentElement: { dataset: { get reduceMotion() { return state.profileReduced; } } },
    } });
    assert.equal(canPlayOptionalBroadcast(), true);
    for (const connection of [{ saveData: true }, { effectiveType: 'slow-2g' }, { effectiveType: '2g' }, { effectiveType: '3g' }, { effectiveType: '4g', downlink: .2 }]) {
      state.connection = connection;
      assert.equal(canPlayOptionalBroadcast(), false);
    }
    state.connection = { effectiveType: '4g', downlink: 5 };
    state.reduced = true;
    assert.equal(canPlayOptionalBroadcast(), false);
    state.reduced = false;
    state.profileReduced = 'true';
    assert.equal(canPlayOptionalBroadcast(), false);
    state.profileReduced = 'false';
    state.hidden = true;
    assert.equal(canPlayOptionalBroadcast(), false);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});