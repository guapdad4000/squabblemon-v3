import {
  starterRecipes,
  validateSavedDeck,
} from "@workspace/squabblemon-engine/data";

export function canUseRewardedRecipe(
  recipeId: string,
  ownedCardIds: string[],
): boolean {
  const recipe = starterRecipes.find((item) => item.id === recipeId);
  return Boolean(
    recipe &&
      validateSavedDeck(
        recipe.catalogCardIds,
        ownedCardIds,
        recipe.hero,
      ).valid,
  );
}

export function canUseRewardedDeck(deckId: string, savedDecks: Array<{ id: string; cardIds: string[]; heroCardId: string }>, ownedCardIds: string[]): boolean {
  const saved = savedDecks.find(deck => deck.id === deckId);
  return saved ? validateSavedDeck(saved.cardIds, ownedCardIds, saved.heroCardId).valid : canUseRewardedRecipe(deckId, ownedCardIds);
}
