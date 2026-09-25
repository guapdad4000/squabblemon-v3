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
