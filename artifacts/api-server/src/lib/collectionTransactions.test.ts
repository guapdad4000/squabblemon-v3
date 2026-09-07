import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, count, eq } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerPackOpeningsTable,
  playerProfilesTable,
} from "@workspace/db";
import { cardCatalog } from "@workspace/squabblemon-engine/data";
import { COLLECTION_ROAD } from "./collectionEconomy";
import {
  claimCollectionRoadForPlayer,
  craftPlayerVariantForPlayer,
  EconomyTransactionError,
  openStreetPackForPlayer,
} from "./collectionTransactions";
import { getPlayerBootstrap } from "./playerState";

test("concurrent retries spend one ticket and persist one pack opening", async (t) => {
  const clerkUserId = `pack-idempotency-${randomUUID()}`;
  const idempotencyKey = randomUUID();
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    packTickets: 2,
  });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  const results = await Promise.all([
    openStreetPackForPlayer(clerkUserId, {
      idempotencyKey,
      paymentMethod: "ticket",
    }),
    openStreetPackForPlayer(clerkUserId, {
      idempotencyKey,
      paymentMethod: "ticket",
    }),
  ]);

  assert.equal(results[0].opening.id, results[1].opening.id);
  assert.deepEqual(
    results.map((result) => result.alreadyOpened).sort(),
    [false, true],
  );

  const [profile] = await db
    .select({ packTickets: playerProfilesTable.packTickets })
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  const [openingCount] = await db
    .select({ value: count() })
    .from(playerPackOpeningsTable)
    .where(
      and(
        eq(playerPackOpeningsTable.clerkUserId, clerkUserId),
        eq(playerPackOpeningsTable.idempotencyKey, idempotencyKey),
      ),
    );

  assert.equal(profile.packTickets, 1);
  assert.equal(openingCount.value, 1);
});

test("a failed Street Pack payment persists no opening", async (t) => {
  const clerkUserId = `pack-balance-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    packTickets: 0,
    softCurrency: 0,
  });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  await assert.rejects(
    () =>
      openStreetPackForPlayer(clerkUserId, {
        idempotencyKey: randomUUID(),
        paymentMethod: "ticket",
      }),
    (error) =>
      error instanceof EconomyTransactionError && error.status === 400,
  );
  const [openingCount] = await db
    .select({ value: count() })
    .from(playerPackOpeningsTable)
    .where(eq(playerPackOpeningsTable.clerkUserId, clerkUserId));
  assert.equal(openingCount.value, 0);
});

test("concurrent crafting retries charge Style Shards once", async (t) => {
  const clerkUserId = `craft-idempotency-${randomUUID()}`;
  const card = cardCatalog[0];
  const variant = card.variantSlots[0];
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ownedCardIds: [card.catalogId],
    styleShards: variant.shardCost * 2,
  });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  const results = await Promise.all([
    craftPlayerVariantForPlayer(
      clerkUserId,
      card.catalogId,
      variant.id,
    ),
    craftPlayerVariantForPlayer(
      clerkUserId,
      card.catalogId,
      variant.id,
    ),
  ]);
  assert.deepEqual(
    results.map((result) => result.alreadyOwned).sort(),
    [false, true],
  );

  const [profile] = await db
    .select({
      styleShards: playerProfilesTable.styleShards,
      ownedVariants: playerProfilesTable.ownedVariants,
    })
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(profile.styleShards, variant.shardCost);
  assert.deepEqual(profile.ownedVariants, [variant.id]);
});

test("concurrent Collection Road retries grant one claim", async (t) => {
  const clerkUserId = `road-idempotency-${randomUUID()}`;
  const milestone = COLLECTION_ROAD[0];
  const startingCards = cardCatalog
    .filter((card) => card.catalogId !== milestone.reward.cardId)
    .slice(0, milestone.threshold)
    .map((card) => card.catalogId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ownedCardIds: startingCards,
    discoveredCardIds: startingCards,
    collectionProgress: startingCards.length,
  });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  const results = await Promise.all([
    claimCollectionRoadForPlayer(clerkUserId, milestone),
    claimCollectionRoadForPlayer(clerkUserId, milestone),
  ]);
  assert.deepEqual(
    results.map((result) => result.alreadyClaimed).sort(),
    [false, true],
  );

  const [claimCount] = await db
    .select({ value: count() })
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, clerkUserId),
        eq(
          playerCollectionClaimsTable.milestoneKey,
          milestone.id,
        ),
      ),
    );
  const [profile] = await db
    .select({ ownedCardIds: playerProfilesTable.ownedCardIds })
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));

  assert.equal(claimCount.value, 1);
  assert.equal(
    profile.ownedCardIds.filter(
      (cardId) => cardId === milestone.reward.cardId,
    ).length,
    1,
  );
});

test("a concurrent bootstrap read cannot erase a pack reward", async (t) => {
  const clerkUserId = `pack-bootstrap-race-${randomUUID()}`;
  const startingCard = cardCatalog[0].catalogId;
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ownedCardIds: [startingCard],
    discoveredCardIds: [startingCard],
    collectionProgress: 1,
    packTickets: 1,
  });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  const [, pack] = await Promise.all([
    getPlayerBootstrap(clerkUserId),
    openStreetPackForPlayer(clerkUserId, {
      idempotencyKey: randomUUID(),
      paymentMethod: "ticket",
    }),
  ]);
  const rewardedCardId = pack.opening.rewards[0].cardId;
  assert.ok(rewardedCardId);

  const [profile] = await db
    .select({
      ownedCardIds: playerProfilesTable.ownedCardIds,
      packTickets: playerProfilesTable.packTickets,
    })
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(profile.packTickets, 0);
  assert.equal(profile.ownedCardIds.includes(rewardedCardId), true);
});