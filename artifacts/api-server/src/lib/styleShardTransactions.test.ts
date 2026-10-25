import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  playerProfilesTable,
  playerPackOpeningsTable,
  playerCollectionClaimsTable,
} from "@workspace/db";
import { cardCatalog } from "@workspace/squabblemon-engine/data";
import {
  totalStyleShardRewards,
  normalizeStyleShardBalances,
} from "@workspace/squabblemon-engine/styleShards";
import {
  openStreetPackForPlayer,
  craftPlayerVariantForPlayer,
} from "./collectionTransactions";
import { purchaseShopItem } from "./shopTransactions";
import { getPlayerBootstrap } from "./playerState";

test.after(async () => {
  await pool.end();
});
const rare = cardCatalog.find((card) => card.rarity === "Rare")!;
async function profile(id: string) {
  const [row] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, id));
  return row;
}

test("pack retry credits each currency and earned monthly milestone exactly once and survives bootstrap reload", async (t) => {
  t.mock.method(Date, "now", () => Date.parse("2026-10-15T12:00:00Z"));
  const id = `rarity-pack-${randomUUID()}`;
  await db
    .insert(playerProfilesTable)
    .values({
      clerkUserId: id,
      onboardingStep: "complete",
      packTickets: 20,
      styleShards: 777,
      styleShardBalances: { Mythical: 9 },
      ownedCardIds: cardCatalog.map((card) => card.catalogId),
    });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id));
  });
  const input = {
    idempotencyKey: randomUUID(),
    paymentMethod: "ticket" as const,
    pullCount: 10,
  };
  const results = await Promise.all([
    openStreetPackForPlayer(id, input),
    openStreetPackForPlayer(id, input),
  ]);
  assert.equal(results.filter(result => !result.alreadyOpened).length, 1);
  assert.deepEqual(results[0].opening, results[1].opening);
  assert.equal(results[0].opening.cost, 10);
  assert.equal(results[0].opening.rewards.length, 60, "ten normal packs retain all six slots each");
  assert.deepEqual(results[0].seasonRewards, [
    { seasonId: "2026-10", threshold: 5, softCurrency: 100, packTickets: 0, styleShards: 0 },
    { seasonId: "2026-10", threshold: 10, softCurrency: 0, packTickets: 1, styleShards: 0 },
  ]);
  assert.deepEqual(results[1].seasonRewards, results[0].seasonRewards, "retry recovers the same milestone receipt");
  assert.equal((await db.select().from(playerPackOpeningsTable).where(eq(playerPackOpeningsTable.clerkUserId, id))).length, 1);
  const claims = await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, id));
  assert.deepEqual(claims.map(claim => claim.milestoneKey).sort(), ["pull-season:2026-10:10", "pull-season:2026-10:5"]);
  const issued = totalStyleShardRewards(results[0].opening.rewards);
  const row = await profile(id);
  assert.equal(row.packTickets, 20 - 10 + 1, "one ten-ticket debit plus the earned threshold-ten ticket");
  const packClout = results[0].opening.rewards.reduce((total, reward) => total + (reward.kind === "softCurrency" ? reward.amount : 0), 0);
  assert.equal(row.softCurrency, packClout + 100, "pack Clout and the threshold-five bonus are separate exact credits");
  assert.equal(row.styleShards, 777 + issued.styleShardsGained);
  assert.deepEqual(row.styleShardBalances, {
    ...issued.styleShardBalancesGained,
    Mythical: issued.styleShardBalancesGained.Mythical + 9,
  });
  const before = JSON.stringify(row.styleShardBalances);
  const bootstrap = await getPlayerBootstrap(id);
  assert.equal(JSON.stringify((await profile(id)).styleShardBalances), before);
  assert.deepEqual(
    bootstrap.profile.styleShardBalances,
    row.styleShardBalances,
  );
});

test("craft and shop race cannot spend the same matching or universal shards twice", async (t) => {
  const id = `rarity-spend-${randomUUID()}`;
  await db
    .insert(playerProfilesTable)
    .values({
      clerkUserId: id,
      onboardingStep: "complete",
      ownedCardIds: [rare.catalogId],
      styleShards: 20,
      styleShardBalances: { Rare: 60, Mythical: 10 },
    });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id));
  });
  const tagged = rare.variantSlots.find((slot) => slot.id.endsWith(":tagged"))!;
  const input = {
    itemId: "tagged-style" as const,
    cardId: rare.catalogId,
    idempotencyKey: randomUUID(),
  };
  const results = await Promise.allSettled([
    purchaseShopItem(id, input),
    craftPlayerVariantForPlayer(id, rare.catalogId, tagged.id),
  ]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  const row = await profile(id);
  assert.equal(row.styleShards, 0);
  assert.equal(row.styleShardBalances.Rare, 0);
  assert.equal(row.styleShardBalances.Mythical, 10);
  assert.deepEqual(row.ownedVariants, [tagged.id]);
  const retried = await craftPlayerVariantForPlayer(
    id,
    rare.catalogId,
    tagged.id,
  );
  assert.equal(retried.alreadyOwned, true);
  assert.equal((await profile(id)).styleShards, 0);
});

test("shop retry persists its mixed payment and wrong-tier funds leave the account untouched", async (t) => {
  const id = `rarity-shop-${randomUUID()}`;
  await db
    .insert(playerProfilesTable)
    .values({
      clerkUserId: id,
      onboardingStep: "complete",
      ownedCardIds: [rare.catalogId],
      styleShards: 20,
      styleShardBalances: { Rare: 60, Mythical: 999 },
    });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id));
  });
  const input = {
    itemId: "tagged-style" as const,
    cardId: rare.catalogId,
    idempotencyKey: randomUUID(),
  };
  const [first, second] = await Promise.all([
    purchaseShopItem(id, input),
    purchaseShopItem(id, input),
  ]);
  assert.deepEqual(first.receipt, second.receipt);
  assert.deepEqual(first.receipt.shardPayment, {
    rarity: "Rare",
    matching: 60,
    universal: 20,
  });
  const chrome = rare.variantSlots.find((slot) => slot.id.endsWith(":chrome"))!;
  await assert.rejects(
    craftPlayerVariantForPlayer(id, rare.catalogId, chrome.id),
    /Rare or Universal/,
  );
  assert.equal((await profile(id)).styleShardBalances.Mythical, 999);
});

test("legacy profile and duplicate receipts keep their universal balance across repeated loads", async (t) => {
  const id = `rarity-legacy-${randomUUID()}`;
  await db
    .insert(playerProfilesTable)
    .values({
      clerkUserId: id,
      onboardingStep: "complete",
      styleShards: 54321,
    });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id));
  });
  await db
    .insert(playerPackOpeningsTable)
    .values({
      clerkUserId: id,
      idempotencyKey: randomUUID(),
      oddsVersion: "street-pack-v6",
      paymentMethod: "ticket",
      cost: 1,
      pityBefore: 0,
      pityAfter: 1,
      rewards: [
        {
          kind: "styleShards",
          cardId: rare.catalogId,
          variantId: null,
          name: "Duplicate",
          rarity: "Rare",
          isNew: false,
          amount: 5,
        },
      ],
    });
  for (let n = 0; n < 2; n++) {
    const bootstrap = await getPlayerBootstrap(id);
    assert.equal(bootstrap.profile.styleShards, 54321);
    assert.deepEqual(
      bootstrap.profile.styleShardBalances,
      normalizeStyleShardBalances({}),
    );
    assert.equal(
      bootstrap.profile.packHistory[0].rewards[0].shardRarity,
      undefined,
    );
  }
});
