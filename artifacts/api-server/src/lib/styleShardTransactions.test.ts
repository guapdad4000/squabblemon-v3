import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  playerProfilesTable,
  playerPackOpeningsTable,
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

test("pack retry credits each currency exactly once and survives bootstrap reload", async (t) => {
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
  assert.equal(results[0].opening.id, results[1].opening.id);
  const issued = totalStyleShardRewards(results[0].opening.rewards);
  const row = await profile(id);
  assert.equal(row.packTickets, 10);
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
