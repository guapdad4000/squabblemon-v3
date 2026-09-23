import assert from "node:assert/strict";
import test from "node:test";
import { cardCatalog, catalogCardById, type CardRarity } from "@workspace/squabblemon-engine/data";
import {
  choosePackCardFromTier,
  STREET_PACK_RARITY_WEIGHTS,
  STREET_PACK_RULES,
} from "@workspace/squabblemon-engine/packRules";
import {
  drawGameplayCard,
  generateStreetPack,
  generateStreetTenPull,
  STREET_PACK_CONFIG,
  STREET_PACK_TEN_PULL_CONFIG,
} from "./collectionEconomy";

const zero = () => 0;
const high = (max: number) => max - 1;
const allCardIds = cardCatalog.map(card => card.catalogId);
const allVariantIds = cardCatalog.flatMap(card => card.variantSlots.map(variant => variant.id));

test("published v6 rules disclose the authoritative independent rarity and bonus behavior", () => {
  assert.equal(STREET_PACK_CONFIG.oddsVersion, "street-pack-v6");
  assert.equal(STREET_PACK_TEN_PULL_CONFIG.oddsVersion, "street-pack-ten-v2");
  assert.equal(STREET_PACK_CONFIG.softCurrencyCost, 200);
  assert.equal(STREET_PACK_TEN_PULL_CONFIG.softCurrencyCost, 1800);
  assert.equal(Object.values(STREET_PACK_RARITY_WEIGHTS).reduce((sum, n) => sum + n, 0), 100);
  const disclosure = STREET_PACK_CONFIG.odds.map(odd => odd.detail).join(" ");
  assert.match(disclosure, /independently/);
  assert.match(disclosure, /Duplicate gameplay cards become 5 Style Shards/);
  assert.match(disclosure, /25 Clout/);
  assert.match(disclosure, /50 gameplay slots/);
  assert.match(disclosure, /duplicate Rare, Super Rare, Legendary, or Mythical counts/);
  assert.match(disclosure, /cosmetic styles do not/);
  assert.match(disclosure, /Rare 80%, Super Rare 15%, Legendary 4%, or Mythical 1%/);
  assert.match(disclosure, /not guaranteed to be a new card/);
  assert.match(disclosure, /empty authored rarity tier fails/);
  assert.match(disclosure, /each amount equally likely/);
  assert.doesNotMatch(disclosure, /\bEpic\b/);
});

test("rarity selection is independent of ownership and first-two protection stays in the rolled tier", () => {
  const common = cardCatalog.filter(card => card.rarity === "SuperCommon");
  assert.ok(common.length >= 2);
  const owned = new Set(allCardIds.filter(id => id !== common[1].catalogId));
  const result = generateStreetPack({
    ownedCardIds: [...owned], discoveredCardIds: [...owned], ownedVariants: [], pity: 0,
  }, zero);
  assert.equal(result.rewards[0].rarity, "SuperCommon");
  assert.equal(result.rewards[0].cardId, common[1].catalogId);
  assert.equal(result.rewards[0].isNew, true);
  assert.equal(result.rewards[1].rarity, "SuperCommon");
  assert.equal(result.rewards[1].kind, "styleShards");
  assert.equal(result.rewards[1].amount, STREET_PACK_RULES.duplicateStyleShards);
});

test("same-pack exclusion restores a tier only after exhaustion", () => {
  const tier = [{ catalogId: "a" }, { catalogId: "b" }];
  const first = choosePackCardFromTier({
    rarity: "Common", tier, pulledCardIds: new Set(["a"]),
    ownedCardIds: new Set(), protectNew: false, rng: zero,
  });
  const restored = choosePackCardFromTier({
    rarity: "Common", tier, pulledCardIds: new Set(["a", "b"]),
    ownedCardIds: new Set(), protectNew: false, rng: zero,
  });
  assert.equal(first.catalogId, "b");
  assert.equal(restored.catalogId, "a");
});

test("an authored empty rarity tier fails explicitly", () => {
  const emptyPools = Object.fromEntries(
    Object.keys(STREET_PACK_RARITY_WEIGHTS).map(rarity => [rarity, []]),
  ) as never;
  assert.throws(() => drawGameplayCard({
    pools: emptyPools, pulledCardIds: new Set(), ownedCardIds: new Set(),
    protectNew: true, rng: zero,
  }), /SuperCommon.*no gameplay cards/);
});

test("bonus boundaries, amounts, pity, and exhausted style conversion match v6", () => {
  const expected = [
    [2999, "styleShards", 5],
    [3000, "softCurrency", 25],
    [9499, "softCurrency", 25],
  ] as const;
  for (const [bonusRoll, kind, amount] of expected) {
    let call = 0;
    const rng = (max: number) => {
      // Five rarity + five card calls, then the bonus roll.
      if (call++ === 10) return bonusRoll;
      return 0;
    };
    const result = generateStreetPack({
      ownedCardIds: allCardIds, discoveredCardIds: allCardIds, ownedVariants: [], pity: 0,
    }, rng);
    assert.equal(result.rewards[5].kind, kind);
    assert.equal(result.rewards[5].amount, amount);
  }

  const pity = generateStreetPack({
    ownedCardIds: allCardIds, discoveredCardIds: allCardIds, ownedVariants: [], pity: 9,
  }, zero);
  assert.equal(pity.rewards[5].kind, "variant");
  assert.equal(pity.pityAfter, 0);

  const exhausted = generateStreetPack({
    ownedCardIds: allCardIds, discoveredCardIds: allCardIds,
    ownedVariants: allVariantIds, pity: 9,
  }, high);
  assert.equal(exhausted.rewards[5].kind, "softCurrency");
  assert.equal(exhausted.rewards[5].amount, 25);
  assert.equal(exhausted.pityAfter, 0);
});

test("ten-pull counts duplicate Rare+ gameplay pulls and never cosmetics", () => {
  // zero always rolls SuperCommon, so the forced guarantee is exercised.
  const forced = generateStreetTenPull({
    ownedCardIds: allCardIds, discoveredCardIds: allCardIds,
    ownedVariants: allVariantIds, pity: 0,
  }, zero);
  assert.equal(forced.rewards.length, 60);
  assert.equal(forced.guaranteedRareIndex, 58);
  // The zero RNG takes the 30% shard bonus branch; the guarantee must leave
  // that final bonus untouched rather than replacing it as v5 did.
  assert.equal(forced.rewards[59].kind, "styleShards");
  assert.equal(forced.rewards[59].amount, 5);
  assert.equal(forced.rewards[59].cardId, null);
  const guaranteed = forced.rewards[58];
  assert.equal(guaranteed.kind, "styleShards");
  assert.equal(guaranteed.amount, 5);
  assert.equal(guaranteed.rarity, "Rare");
  assert.equal(forced.styleShardsGained,
    forced.rewards.filter(r => r.kind === "styleShards").reduce((sum, r) => sum + r.amount, 0));
  assert.equal(forced.softCurrencyGained,
    forced.rewards.filter(r => r.kind === "softCurrency").reduce((sum, r) => sum + r.amount, 0));
});

test("forced Rare+ uses 80/15/4/1 rarity boundaries independent of ownership", () => {
  const boundaryCases: Array<[number, CardRarity]> = [
    [0, "Rare"], [7999, "Rare"], [8000, "Epic"],
    [9499, "Epic"], [9500, "Legendary"], [9899, "Legendary"], [9900, "Mythical"],
  ];
  for (const [guaranteeRoll, rarity] of boundaryCases) {
    // Every exhausted-style pack makes twelve RNG calls:
    // rarity/card x5, bonus outcome, then bonus amount.
    let calls = 0;
    const counted = (max: number) => {
      calls += 1;
      return calls === 121 ? guaranteeRoll : 0;
    };
    const result = generateStreetTenPull({
      ownedCardIds: allCardIds, discoveredCardIds: allCardIds,
      ownedVariants: allVariantIds, pity: 0,
    }, counted);
    assert.equal(result.rewards[58].rarity, rarity);
    assert.equal(result.rewards[58].kind, "styleShards");
  }
});

test("effective rarity frequencies follow the fixed weights regardless of ownership", () => {
  let state = 0x12345678;
  const rng = (max: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % max;
  };
  const counts = new Map<CardRarity, number>();
  const pulls = 100_000;
  for (let i = 0; i < pulls; i++) {
    const reward = drawGameplayCard({
      pulledCardIds: new Set(), ownedCardIds: new Set(allCardIds),
      protectNew: i % 2 === 0, rng,
    });
    counts.set(reward.rarity, (counts.get(reward.rarity) ?? 0) + 1);
  }
  for (const [rarity, expected] of Object.entries(STREET_PACK_RARITY_WEIGHTS)) {
    const actual = (counts.get(rarity as CardRarity) ?? 0) / pulls * 100;
    // Six binomial standard errors, plus one observation for discretization.
    // Unlike a flat percentage tolerance, this also detects missing Mythicals.
    const probability = expected / 100;
    const tolerance = 100 * (6 * Math.sqrt(probability * (1 - probability) / pulls) + 1 / pulls);
    assert.ok(Math.abs(actual - expected) < tolerance, `${rarity}: ${actual}% vs ${expected}% (±${tolerance})`);
  }
});

test("future earned IDs remain intact while active rewards come from the current catalog", () => {
  const result = generateStreetTenPull({
    ownedCardIds: ["next-release-character"], discoveredCardIds: ["next-release-character"],
    ownedVariants: [], pity: 0,
  }, zero);
  assert.ok(result.ownedCardIds.includes("next-release-character"));
  assert.ok(result.discoveredCardIds.includes("next-release-character"));
  assert.ok(result.rewards.filter(r => r.kind === "card").every(r => r.cardId && catalogCardById[r.cardId]));
});