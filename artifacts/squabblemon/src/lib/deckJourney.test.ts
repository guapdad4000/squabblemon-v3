import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deckEditorPath,
  deckListContextKey,
  deckTestPath,
  readDeckListContext,
  saveDeckListContext,
} from './deckJourney';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('deck journey', () => {
  it('builds encoded nested routes', () => {
    assert.equal(deckEditorPath('starter / one'), '/game/decks/starter%20%2F%20one');
    assert.equal(deckTestPath('starter / one'), '/game/decks/starter%20%2F%20one/test');
  });

  it('restores valid per-player list context safely', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    saveDeckListContext('player/a', { selectedDeckId: 'deck-two', scrollTop: 418 }, storage);
    assert.deepEqual(readDeckListContext('player/a', storage), { selectedDeckId: 'deck-two', scrollTop: 418 });
    assert.equal(readDeckListContext('player/b', storage), null);
    storage.setItem(deckListContextKey('player/a'), '{broken');
    assert.equal(readDeckListContext('player/a', storage), null);
  });
});