import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_RARITIES,
  CARD_RARITY_DEFINITIONS, type CardRarity,
  cardCatalog,
  catalogCardById,
  validateCardCatalogRarities,
} from "@workspace/squabblemon-engine/data";
import {
  STREET_PACK_CONFIG,
  STREET_PACK_RARITY_WEIGHTS,
  STREET_PACK_TEN_PULL_CONFIG,
  generateStreetPack,
  generateStreetTenPull,
} from "./collectionEconomy";

const zero = () => 0;

test('collection protection handles one or two remaining cards without repeats or duplicate unlocks', () => {
  for (const count of [1, 2]) {
    const missing = cardCatalog.slice(-count).map(card => card.catalogId);
    const owned = cardCatalog.filter(card => !missing.includes(card.catalogId)).map(card => card.catalogId);
    const result = generateStreetPack({ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0}, zero);
    assert.deepEqual(result.rewards.slice(0,count).map(reward => reward.cardId).sort(), missing.sort());
    assert.equal(result.ownedCardIds.length, cardCatalog.length);
    assert.equal(result.rewards.filter(reward => reward.kind === 'card').length, count);
    assert.equal(new Set(result.rewards.slice(0,5).map(reward => reward.cardId)).size,5);
    assert.equal(result.styleShardsGained, (5-count)*25+15);
  }
});

test('bonus boundaries match disclosed odds and the credited wallet totals match all six rewards', () => {
  for (const [roll, kind] of [[6999,'styleShards'],[7000,'softCurrency'],[9499,'softCurrency'],[9500,'variant']] as const) {
    let calls = 0;
    const result = generateStreetPack({ownedCardIds: cardCatalog.map(c => c.catalogId), discoveredCardIds: [], ownedVariants: [], pity: 0}, () => calls++ === 10 ? roll : 0);
    assert.equal(result.rewards[5].kind,kind);
    assert.equal(result.styleShardsGained,result.rewards.filter(r => r.kind === 'styleShards').reduce((sum,r) => sum+r.amount,0));
    assert.equal(result.softCurrencyGained,result.rewards.filter(r => r.kind === 'softCurrency').reduce((sum,r) => sum+r.amount,0));
    assert.equal(result.rewards.length,6);
  }
});

test("Street Packs reveal five distinct card pulls plus a bonus and protect the first two recruits", () => {
  const result = generateStreetPack(
    {
      ownedCardIds: [],
      discoveredCardIds: [],
      ownedVariants: [],
      pity: 0,
    },
    zero,
  );

  assert.equal(result.rewards.length, 6);
  assert.equal(result.rewards[0].kind, "card");
  assert.equal(result.rewards[0].isNew, true);
  assert.equal(result.rewards[1].isNew, true);
  assert.equal(new Set(result.rewards.slice(0, 5).map(r => r.cardId)).size, 5);
  assert.equal(result.ownedCardIds.length, 5);
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
      { example: "Mythic" },
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

  assert.equal(result.rewards[5].kind, "variant");
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
  assert.equal(result.rewards[5].kind, "variant");
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
    (odd) => odd.label === "Bonus · Featured style",
  );

  assert.equal(result.rewards[5].kind, "styleShards");
  assert.equal(result.rewards[5].amount, 50);
  assert.equal(result.pityAfter, 0);
  assert.match(
    publishedStyleOdds?.detail ?? "",
    /5%.*50 Style Shards/,
  );
});

test("ten-pull guarantees Rare+ without hiding or over-crediting a replaced bonus", () => {
  const allCards = cardCatalog.map((card) => card.catalogId);
  const allVariants = cardCatalog.flatMap((card) => card.variantSlots.map((variant) => variant.id));
  const result = generateStreetTenPull(
    { ownedCardIds: allCards, discoveredCardIds: allCards, ownedVariants: allVariants, pity: 0 },
    zero,
  );
  const creditedShards = result.rewards
    .filter((reward) => reward.kind === "styleShards")
    .reduce((sum, reward) => sum + reward.amount, 0);
  const creditedClout = result.rewards
    .filter((reward) => reward.kind === "softCurrency")
    .reduce((sum, reward) => sum + reward.amount, 0);
  const guaranteed = result.rewards[result.guaranteedRareIndex!];

  assert.equal(result.rewards.length, STREET_PACK_TEN_PULL_CONFIG.rewardsPerPull);
  assert.equal(result.styleShardsGained, creditedShards);
  assert.equal(result.softCurrencyGained, creditedClout);
  assert.ok(["Rare", "Epic", "Legendary", "Mythical"].includes(guaranteed.rarity!));
  assert.equal(guaranteed.kind, "styleShards");
  assert.equal(guaranteed.isNew, false);
});

test("ten-pull guarantee prefers an unowned Rare+ before an owned Mythical", () => {
  const ownedMythicals = cardCatalog
    .filter((card) => card.rarity === "Mythical")
    .map((card) => card.catalogId);
  const result = generateStreetTenPull(
    { ownedCardIds: ownedMythicals, discoveredCardIds: ownedMythicals, ownedVariants: [], pity: 0 },
    zero,
  );
  const guaranteed = result.rewards[result.guaranteedRareIndex!];

  assert.equal(guaranteed.kind, "card");
  assert.equal(guaranteed.isNew, true);
  assert.ok(["Rare", "Epic", "Legendary"].includes(guaranteed.rarity!));
});

test("published rarity odds are generated from the roll weights", () => {
  const published = STREET_PACK_CONFIG.odds.find(
    (odd) => odd.label === "Slots 3–5 · Gang cards",
  )?.detail ?? "";
  assert.equal(
    Object.values(STREET_PACK_RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    100,
  );
  for (const [rarity, weight] of Object.entries(STREET_PACK_RARITY_WEIGHTS)) {
    assert(published.includes(`${CARD_RARITY_DEFINITIONS[rarity as CardRarity].label} ${weight}%`));
  }
});
