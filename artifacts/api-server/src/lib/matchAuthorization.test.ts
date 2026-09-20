import assert from "node:assert/strict";
import test from "node:test";
import { starterRecipes, ROOKIE_CORE_IDS, ROOKIE_FOUNDATION_IDS } from "@workspace/squabblemon-engine/data";
import { canUseRewardedRecipe, canUseRewardedDeck } from "./matchAuthorization";

test("rewarded practice accepts only gangs whose ten cards are owned", () => {
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

test('custom fades require a legal owned saved roster, including mixed gangs', () => {
  const deck = { id: 'personal', cardIds: [...ROOKIE_CORE_IDS.slice(0, 9), 'nail-tech'], heroCardId: 'nail-tech' };
  assert.equal(canUseRewardedDeck('personal', [deck], ROOKIE_FOUNDATION_IDS), true);
  assert.equal(canUseRewardedDeck('personal', [deck], ROOKIE_CORE_IDS), false);
  assert.equal(canUseRewardedDeck('someone-elses', [deck], ROOKIE_FOUNDATION_IDS), false);
  assert.equal(canUseRewardedDeck('personal', [{ ...deck, cardIds: deck.cardIds.slice(0,6) }], ROOKIE_FOUNDATION_IDS), false);
  assert.equal(canUseRewardedDeck('personal', [{ ...deck, heroCardId: 'closet-nerd' }], ROOKIE_FOUNDATION_IDS), false);
  assert.equal(canUseRewardedDeck('personal', [{ ...deck, cardIds: Array(10).fill('cornball') }], ROOKIE_FOUNDATION_IDS), false);
});
