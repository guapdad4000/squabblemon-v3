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