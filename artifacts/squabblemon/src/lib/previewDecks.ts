import type { PlayerBootstrap, SavedDeck, SaveDeckInput } from '@workspace/api-client-react';
import { DECK_SIZE, cardCatalog, upgradeLegacySavedDeck, validateSavedDeck } from '../data';

export const PREVIEW_DECKS_KEY = 'squabblemon.preview-decks.v1';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

export function readPreviewDecks(storage: Storage = localStorage): SavedDeck[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(PREVIEW_DECKS_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((deck): deck is SavedDeck => !!deck && typeof deck.id === 'string'
      && typeof deck.name === 'string' && typeof deck.heroCardId === 'string'
      && (deck.recipeId === null || typeof deck.recipeId === 'string')
      && Array.isArray(deck.cardIds) && deck.cardIds.every((id: unknown) => typeof id === 'string')
      && typeof deck.valid === 'boolean' && Array.isArray(deck.issues)).map(deck => {
      const owned = cardCatalog.map(card => card.catalogId);
      const { deckSize, ...savedDeck } = deck as SavedDeck & { deckSize?: number };
      const cardIds = deckSize === undefined ? upgradeLegacySavedDeck(deck.cardIds, owned) : deck.cardIds;
      const legality = validateSavedDeck(cardIds, owned, deck.heroCardId);
      return { ...savedDeck, cardIds, valid: legality.valid, issues: legality.issues };
    });
  } catch { return []; }
}

/** Called only for the dev-only synthetic account, never as a fallback for real saves. */
export function updatePreviewDeck(bootstrap: PlayerBootstrap, deckId: string, draft: SaveDeckInput | null, storage: Storage = localStorage): PlayerBootstrap {
  const decks = [...bootstrap.profile.savedDecks];
  const index = decks.findIndex(deck => deck.id === deckId);
  if (draft) {
    const name = draft.name.trim();
    if (name.length < 2 || name.length > 32) throw new Error('Deck names must be 2–32 characters.');
    if (index < 0 && decks.length >= bootstrap.profile.deckSlots) throw new Error('All deck slots are full.');
    const legality = validateSavedDeck(draft.cardIds, bootstrap.profile.ownedCardIds, draft.heroCardId);
    const deck: SavedDeck = { ...draft, recipeId: draft.recipeId ?? null, id: deckId, name, valid: legality.valid, issues: legality.issues };
    if (index < 0) decks.push(deck); else decks[index] = deck;
  } else if (index >= 0) decks.splice(index, 1);
  // Persist before publishing the successful result; failed storage must not claim a save.
  storage.setItem(PREVIEW_DECKS_KEY, JSON.stringify(decks.map(deck => ({ ...deck, deckSize: DECK_SIZE }))));
  return { ...bootstrap, profile: { ...bootstrap.profile, savedDecks: decks } };
}
