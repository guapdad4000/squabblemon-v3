import assert from "node:assert/strict";
import test from "node:test";
import { cardCatalog } from "@workspace/squabblemon-engine/data";
import {
  planShopPurchase,
  type ShopWallet,
} from "@workspace/squabblemon-engine/economy";
import {
  normalizeStyleShardBalances,
  quoteStyleShards,
  spendStyleShards,
  totalStyleShardRewards,
  addStyleShardBalances,
} from "@workspace/squabblemon-engine/styleShards";
import { generateStreetPack } from "./collectionEconomy";

test("existing shards retain every old crafting price with no migration or re-credit", () => {
  for (const card of cardCatalog)
    for (const slot of card.variantSlots) {
      const spent = spendStyleShards(
        { styleShards: slot.shardCost },
        card.rarity,
        slot.shardCost,
      );
      assert.equal(spent.styleShards, 0);
      assert.equal(spent.payment.universal, slot.shardCost);
      assert.equal(spent.payment.matching, 0);
    }
  const legacy = {
    kind: "styleShards",
    amount: 25,
    rarity: "Mythical",
    cardId: "dr-fade",
  };
  assert.deepEqual(totalStyleShardRewards([legacy]), {
    styleShardsGained: 25,
    styleShardBalancesGained: normalizeStyleShardBalances({}),
  });
});

test("matching shards spend first, other tiers are untouched, and the quote matches the debit", () => {
  const wallet = {
    styleShards: 50,
    styleShardBalances: { Rare: 65, Mythical: 800 },
  };
  const quote = quoteStyleShards(wallet, "Rare", 80);
  const spent = spendStyleShards(wallet, "Rare", 80);
  assert.equal(quote.matchingSpend, 65);
  assert.equal(quote.universalSpend, 15);
  assert.equal(spent.styleShardBalances.Rare, 0);
  assert.equal(spent.styleShardBalances.Mythical, 800);
  assert.equal(spent.styleShards, 35);
  assert.deepEqual(wallet, {
    styleShards: 50,
    styleShardBalances: { Rare: 65, Mythical: 800 },
  });
  assert.equal(
    quoteStyleShards(
      { styleShards: 0, styleShardBalances: { Common: 80 } },
      "SuperCommon",
      80,
    ).canAfford,
    true,
  );
});

test("wrong-tier shards cannot buy a style; malformed costs cannot mint currency", () => {
  const wallet = {
    styleShards: 10,
    styleShardBalances: { Rare: 20, Legendary: 99999 },
  };
  assert.equal(quoteStyleShards(wallet, "Rare", 80).shortfall, 50);
  assert.throws(
    () => spendStyleShards(wallet, "Rare", 80),
    /50 more Rare or Universal/,
  );
  for (const cost of [-1, 0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => spendStyleShards(wallet, "Rare", cost), /Invalid/);
  }
  assert.throws(
    () => addStyleShardBalances({ Rare: 2147483647 }, { Rare: 1 }),
    /range/,
  );
  assert.throws(
    () =>
      totalStyleShardRewards([
        { kind: "styleShards", amount: 20, shardRarity: "Fake" },
      ]),
    /Unknown/,
  );
});

test("all pack rarity boundaries award the matching amount and keep bonuses universal", () => {
  const cases = [
    [0, "Common", 5],
    [4000, "Common", 5],
    [6000, "Uncommon", 8],
    [8500, "Rare", 12],
    [9700, "Epic", 20],
    [9900, "Legendary", 40],
    [9980, "Mythical", 80],
  ] as const;
  const ids = cardCatalog.map((card) => card.catalogId);
  for (const [roll, tier, amount] of cases) {
    let calls = 0;
    const result = generateStreetPack(
      { ownedCardIds: ids, discoveredCardIds: ids, ownedVariants: [], pity: 0 },
      () => {
        const index = calls++;
        return index < 10 && index % 2 === 0 ? roll : 0;
      },
    );
    assert.equal(result.styleShardBalancesGained[tier], 5 * amount);
    assert.equal(result.styleShardsGained, 5);
    assert.ok(
      result.rewards
        .slice(0, 5)
        .every(
          (reward) => reward.shardRarity === tier && reward.amount === amount,
        ),
    );
    assert.equal(result.rewards[5].shardRarity ?? null, null);
  }
});

test("shop plan spends the same wallet as direct crafting and records the exact payment", () => {
  const card = cardCatalog.find((card) => card.rarity === "Rare")!;
  const wallet: ShopWallet = {
    styleShards: 50,
    styleShardBalances: { Rare: 60 },
    softCurrency: 0,
    packTickets: 0,
    deckSlots: 4,
    ownedCardIds: [card.catalogId],
    discoveredCardIds: [],
    ownedVariants: [],
    cardProgression: {},
    collectionProgress: 1,
  };
  const plan = planShopPurchase(wallet, {
    itemId: "tagged-style",
    cardId: card.catalogId,
  });
  assert.equal(plan.wallet.styleShards, 30);
  assert.equal(plan.wallet.styleShardBalances?.Rare, 0);
  assert.deepEqual(plan.receipt.shardPayment, {
    rarity: "Rare",
    matching: 60,
    universal: 20,
  });
  assert.throws(
    () =>
      planShopPurchase(plan.wallet, {
        itemId: "tagged-style",
        cardId: card.catalogId,
      }),
    /already own/,
  );
});
