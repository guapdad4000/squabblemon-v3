import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_RARITIES,
  cardCatalog,
  catalogCardById,
  validateCardCatalogRarities,
} from "@workspace/squabblemon-engine/data";
import {
  STREET_PACK_CONFIG,
  STREET_PACK_RARITY_WEIGHTS,
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
  assert.equal(
    result.rewards[0].rarity,
    catalogCardById[result.rewards[0].cardId!].rarity,
  );
  assert.equal(result.ownedCardIds.length, cardCatalog.length);
  assert.equal(result.styleShardsGained >= 25, true);
});

test("every catalog card has one supported authoritative rarity", () => {
  assert.doesNotThrow(() => validateCardCatalogRarities());
  assert.equal(cardCatalog.length > 0, true);
  for (const card of cardCatalog) {
    assert.equal(CARD_RARITIES.includes(card.rarity), true);
  }
});

test("catalog validation rejects missing and unsupported rarity assignments", () => {
  assert.throws(
    () => validateCardCatalogRarities({ example: cardCatalog[0] }, {}),
    /missing or unsupported rarity/,
  );
  assert.throws(
    () => validateCardCatalogRarities(
      { example: cardCatalog[0] },
      { example: "Legendary" },
    ),
    /missing or unsupported rarity/,
  );
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

test("published rarity odds are generated from the roll weights", () => {
  const published = STREET_PACK_CONFIG.odds.find(
    (odd) => odd.label === "Slot 2 · Crew card",
  )?.detail ?? "";
  assert.equal(
    Object.values(STREET_PACK_RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    100,
  );
  for (const [rarity, weight] of Object.entries(STREET_PACK_RARITY_WEIGHTS)) {
    assert.match(published, new RegExp(`${rarity} ${weight}%`));
  }
});