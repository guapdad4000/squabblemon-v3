import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFallback, readMemory, writeMemory } from './navigationMemory';

test('direct entries return to their logical parent without leaving the app', () => {
  assert.equal(routeFallback('/game/decks/my-crew/test'), '/game/decks/my-crew');
  assert.equal(routeFallback('/game/decks/my-crew'), '/game/decks');
  assert.equal(routeFallback('/game/style/kyle'), '/game/style');
  assert.equal(routeFallback('/game/online/ABCD'), '/game/online');
  assert.equal(routeFallback('/game/story/play/chapter-one'), '/game/story');
  assert.equal(routeFallback('/game/story?season=one'), '/game/story');
  assert.equal(routeFallback('/game/challenges'), '/game');
  assert.equal(routeFallback('/game/shop?view=corner&order=receipt&payment=success'), '/game/shop?view=corner');
  assert.equal(routeFallback('/game/shop?view=corner'), '/game');
  assert.equal(routeFallback('/game/shop?view=packs'), '/game');
  assert.equal(routeFallback('/game/collection?card=guap&variant=gold'), '/game/collection');
  assert.equal(routeFallback('/game/settings#style'), '/game');
  assert.equal(routeFallback('/game/online?tab=friends'), '/game');
});

test('view memory tolerates blocked and corrupt session storage', () => {
  const original = globalThis.sessionStorage;
  const data = new Map<string,string>();
  globalThis.sessionStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key,value) => { data.set(key,value); },
  } as Storage;
  try {
    writeMemory('tab', 'road');
    assert.equal(readMemory('tab','cards'), 'road');
    data.set('squabblemon:navigation:tab','broken');
    assert.equal(readMemory('tab','cards'), 'cards');
    globalThis.sessionStorage.setItem = () => { throw Error('Disabled'); };
    assert.doesNotThrow(() => writeMemory('tab','cards'));
  } finally { globalThis.sessionStorage = original; }
});

test('direct Punch on Patrol entries return to their arcade and preserve other navigation choices', () => {
  assert.equal(routeFallback('/game/challenges?game=punch-on-patrol'), '/game/challenges');
  assert.equal(
    routeFallback('/game/challenges?machine=road&game=punch-on-patrol&notification=milestone#arcade'),
    '/game/challenges?machine=road&notification=milestone#arcade',
  );
  assert.equal(routeFallback('/game/training?game=punch-on-patrol&tab=drills'), '/game/training?tab=drills');
  assert.equal(routeFallback('/game/challenges?game=another-game'), '/game');
  assert.equal(routeFallback('/game/challenges#arcade'), '/game');
});

test('direct chess entries return to the complete arcade with its other query choices', () => {
  assert.equal(routeFallback('/game/challenges?game=check-the-block'), '/game/challenges');
  assert.equal(routeFallback('/game/challenges?source=park&game=check-the-block#machines'), '/game/challenges?source=park#machines');
  assert.equal(routeFallback('/game/training?game=check-the-block'), '/game/training');
});
