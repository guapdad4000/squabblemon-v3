import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { starterRecipes } from '../data';
import { readPreviewDecks, updatePreviewDeck } from './previewDecks';

test('preview deck saves survive reload, updates keep one copy, and deleting releases the slot', () => {
  let saved = '';
  const storage = { getItem: () => saved || null, setItem: (_: string, value: string) => { saved = value; } };
  const recipe = starterRecipes[0];
  const initial = { profile: { savedDecks: [], deckSlots: 1, ownedCardIds: recipe.catalogCardIds } } as unknown as PlayerBootstrap;
  const draft = { name: 'My Gang', cardIds: recipe.catalogCardIds, heroCardId: recipe.hero, recipeId: recipe.id };
  const first = updatePreviewDeck(initial, 'local-one', draft, storage);
  assert.equal(initial.profile.savedDecks.length, 0);
  assert.deepEqual(readPreviewDecks(storage), first.profile.savedDecks);
  assert.equal(first.profile.savedDecks[0].valid, true);
  assert.throws(() => updatePreviewDeck(first, 'local-two', draft, storage), /slots are full/);
  const renamed = updatePreviewDeck(first, 'local-one', { ...draft, name: 'Renamed' }, storage);
  assert.equal(renamed.profile.savedDecks.length, 1);
  assert.equal(readPreviewDecks(storage)[0].name, 'Renamed');
  const deleted = updatePreviewDeck(renamed, 'local-one', null, storage);
  assert.deepEqual(deleted.profile.savedDecks, []);
  assert.deepEqual(readPreviewDecks(storage), []);
});

test('corrupt local saves fall back safely and blocked storage does not report success', () => {
  assert.deepEqual(readPreviewDecks({ getItem: () => 'bad json', setItem: () => {} }), []);
  const bootstrap = { profile: { savedDecks: [], deckSlots: 4, ownedCardIds: [] } } as unknown as PlayerBootstrap;
  assert.throws(() => updatePreviewDeck(bootstrap, 'local', null, { getItem: () => null, setItem: () => { throw new Error('Storage full'); } }), /Storage full/);
});

test('legacy gangs expand once while newly saved seven-card drafts stay incomplete', () => {
  const recipe = starterRecipes[0];
  const old = { id: 'old', name: 'Old Gang', cardIds: recipe.catalogCardIds.slice(0, 7), heroCardId: recipe.hero, recipeId: null, valid: true, issues: [] };
  let saved = JSON.stringify([old]);
  const storage = { getItem: () => saved, setItem: (_: string, value: string) => { saved = value; } };
  const migrated = readPreviewDecks(storage)[0];
  assert.equal(migrated.cardIds.length, 10);
  assert.deepEqual(migrated.cardIds.slice(0, 7), old.cardIds);
  const bootstrap = { profile: { savedDecks: [migrated], deckSlots: 4, ownedCardIds: recipe.catalogCardIds } } as unknown as PlayerBootstrap;
  updatePreviewDeck(bootstrap, old.id, old, storage);
  const draft = readPreviewDecks(storage)[0];
  assert.deepEqual(draft.cardIds, old.cardIds);
  assert.equal(draft.valid, false);
  assert(draft.issues.includes('Add 3 more cards.'));
});
