import assert from "node:assert/strict";
import test from "node:test";
import { starterRecipes } from "@workspace/squabblemon-engine/data";
import { canUseRewardedRecipe } from "./matchAuthorization";

test("rewarded practice accepts only crews whose seven cards are owned", () => {
  const recipe = starterRecipes[0];
  assert.equal(
    canUseRewardedRecipe(recipe.id, recipe.catalogCardIds),
    true,
  );
  assert.equal(
    canUseRewardedRecipe(recipe.id, recipe.catalogCardIds.slice(0, 6)),
    false,
  );
  assert.equal(
    canUseRewardedRecipe("not-a-real-crew", recipe.catalogCardIds),
    false,
  );
});