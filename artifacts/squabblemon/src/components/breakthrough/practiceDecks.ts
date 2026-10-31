import type { PlayerBootstrap } from '@workspace/api-client-react';
import {
  starterRecipes,
  validateSavedDeck,
} from '@workspace/squabblemon-engine/data';
import {
  BREAKTHROUGH_STARTER_DECKS,
  validateBreakthroughDeck,
} from '@workspace/squabblemon-engine/breakthroughCatalog';
import type { PickerDeck } from '../CompactDeckPicker';

export function accountPracticeDecks(
  profile: PlayerBootstrap['profile'],
): PickerDeck[] {
  const saved = profile.savedDecks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    heroCardId: deck.heroCardId ?? '',
    cardIds: [...deck.cardIds],
  }));
  return [
    ...saved,
    ...starterRecipes
      .filter(
        (recipe) =>
          !saved.some((deck) => deck.id === recipe.id) &&
          validateSavedDeck(
            recipe.catalogCardIds,
            profile.ownedCardIds,
            recipe.hero,
          ).valid,
      )
      .map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        heroCardId: recipe.hero,
        cardIds: [...recipe.catalogCardIds],
      })),
  ];
}
export function practiceDeckLegality(deck: PickerDeck, owned: string[]) {
  return validateBreakthroughDeck(deck.cardIds, owned, deck.heroCardId);
}
export function practiceLoaner(): PickerDeck {
  const recipe = BREAKTHROUGH_STARTER_DECKS[0];
  if (!recipe) throw new Error('No reviewed Breakthrough loaner available');
  return {
    id: `loaner:${recipe.id}`,
    name: `${recipe.name} · Loaner`,
    heroCardId: recipe.hero,
    cardIds: [...recipe.catalogCardIds],
  };
}
export function practiceOpponent(seed: number): string[] {
  const recipe =
    BREAKTHROUGH_STARTER_DECKS[
      (seed >>> 0) % BREAKTHROUGH_STARTER_DECKS.length
    ];
  if (!recipe) throw new Error('No reviewed CPU crew available');
  return [...recipe.catalogCardIds];
}
export const breakthroughDeckEditorPath = (id: string) =>
  `/game/decks/${encodeURIComponent(id)}?returnTo=${encodeURIComponent('/game/kumite/breakthrough')}`;
