import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deckSelectionStorageKey,
  persistDeckSelection,
  resolveDeckSelection,
  type DeckSelectionStorage,
} from './deckSelection';

class MemoryStorage implements DeckSelectionStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('restores a valid saved or custom deck', () => {
  const storage = new MemoryStorage();
  assert.equal(persistDeckSelection('player-a', 'custom-2', ['starter', 'custom-2'], storage), true);
  assert.equal(resolveDeckSelection('player-a', ['starter', 'custom-2'], null, storage), 'custom-2');
});

test('falls back safely when the remembered deck was deleted or invalid', () => {
  const storage = new MemoryStorage();
  storage.setItem(deckSelectionStorageKey('player-a'), 'deleted-deck');
  assert.equal(resolveDeckSelection('player-a', ['starter', 'saved'], null, storage), 'starter');
  assert.equal(persistDeckSelection('player-a', 'not-available', ['starter'], storage), false);
  assert.equal(storage.getItem(deckSelectionStorageKey('player-a')), 'deleted-deck');
});

test('keeps deck choices isolated by player profile', () => {
  const storage = new MemoryStorage();
  persistDeckSelection('player-a', 'alpha', ['alpha', 'beta'], storage);
  persistDeckSelection('player-b', 'beta', ['alpha', 'beta'], storage);
  assert.equal(resolveDeckSelection('player-a', ['alpha', 'beta'], null, storage), 'alpha');
  assert.equal(resolveDeckSelection('player-b', ['alpha', 'beta'], null, storage), 'beta');
});

test('an explicit valid selection synchronizes ahead of stored preference', () => {
  const storage = new MemoryStorage();
  persistDeckSelection('player-a', 'old', ['old', 'new'], storage);
  assert.equal(resolveDeckSelection('player-a', ['old', 'new'], 'new', storage), 'new');
});