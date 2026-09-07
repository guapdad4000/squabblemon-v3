import assert from "node:assert/strict";
import test from "node:test";
import { cardCatalog } from "@workspace/squabblemon-engine/data";
import {
  STREET_PACK_CONFIG,
  generateStreetPack,
} from "./collectionEconomy";

const zero = () => 0;

test("Street Packs reveal three rewards and guarantee a missing gameplay card", () => {
  const result = generateStreetPack(
    {
      ownedCardIds: [],
      discoveredCardIds: [],
      ownedVariants: [],
      pity: 0,
    },
    zero,
  );

  assert.equal(result.rewards.length, 3);
  assert.equal(result.rewards[0].kind, "card");
  assert.equal(result.rewards[0].isNew, true);
  assert.equal(result.ownedCardIds.length >= 1, true);
  assert.equal(result.pityAfter, 1);
});

test("duplicate gameplay pulls convert into Style Shards", () => {
  const allCards = cardCatalog.map((card) => card.catalogId);
  const result = generateStreetPack(
    {
      ownedCardIds: allCards,
      discoveredCardIds: allCards,
      ownedVariants: [],
      pity: 0,
    },
    zero,
  );

  assert.equal(result.rewards[0].kind, "styleShards");
  assert.equal(result.rewards[0].amount, 25);
  assert.equal(result.ownedCardIds.length, cardCatalog.length);
  assert.equal(result.styleShardsGained >= 25, true);
});

test("the tenth eligible pack forces an unowned featured variant", () => {
  const allCards = cardCatalog.map((card) => card.catalogId);
  const result = generateStreetPack(
    {
      ownedCardIds: allCards,
      discoveredCardIds: allCards,
      ownedVariants: [],
      pity: 9,
    },
    zero,
  );

  assert.equal(result.rewards[1].kind, "variant");
  assert.equal(result.ownedVariants.length, 1);
  assert.equal(result.pityAfter, 0);
});

test("a guaranteed missing gameplay card does not reset style pity", () => {
  const result = generateStreetPack(
    {
      ownedCardIds: [],
      discoveredCardIds: [],
      ownedVariants: [],
      pity: 9,
    },
    zero,
  );

  assert.equal(result.rewards[0].kind, "card");
  assert.equal(result.rewards[1].kind, "variant");
  assert.equal(result.pityAfter, 0);
});

test("the published odds disclose the exhausted style-pool fallback", () => {
  const allVariantIds = cardCatalog.flatMap((card) =>
    card.variantSlots.map((variant) => variant.id),
  );
  const high = (maxExclusive: number) => maxExclusive - 1;
  const result = generateStreetPack(
    {
      ownedCardIds: cardCatalog.map((card) => card.catalogId),
      discoveredCardIds: cardCatalog.map((card) => card.catalogId),
      ownedVariants: allVariantIds,
      pity: 9,
    },
    high,
  );
  const publishedStyleOdds = STREET_PACK_CONFIG.odds.find(
    (odd) => odd.label === "Slot 2 · Featured style",
  );

  assert.equal(result.rewards[1].kind, "styleShards");
  assert.equal(result.rewards[1].amount, 50);
  assert.equal(result.pityAfter, 0);
  assert.match(
    publishedStyleOdds?.detail ?? "",
    /5%.*50 Style Shards/,
  );
});