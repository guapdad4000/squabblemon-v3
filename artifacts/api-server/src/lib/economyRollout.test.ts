import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, count, eq } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerMissionsTable,
  playerPackOpeningsTable,
  playerProfilesTable,
  type PlayerPackOpeningRecord,
} from "@workspace/db";
import { claimMissionReward } from "./playerRewardTransactions";
import { openStreetPackForPlayer } from "./collectionTransactions";
import {
  ensurePlayer,
  getPlayerBootstrap,
  serializePackOpening,
} from "./playerState";
import { purchaseShopItem } from "./shopTransactions";

function cleanup(t: test.TestContext, clerkUserId: string): void {
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });
}

async function profileFor(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.ok(profile);
  return profile;
}

test("rollout normalization never confiscates legacy balances, pity, or future catalog inventory", async (t) => {
  const clerkUserId = `economy-rollout-preserve-${randomUUID()}`;
  cleanup(t, clerkUserId);
  const futureCardId = "future-rollout-card";
  const futureVariantId = `${futureCardId}:launch`;
  const savedDeck = {
    id: "future-wallet-deck",
    name: "Future Wallet",
    deckSize: 10,
    cardIds: [futureCardId],
    heroCardId: futureCardId,
    recipeId: null,
  };
  const cardProgress = { xp: 875, level: 4, moveTier: 1 };

  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    xp: 987_654,
    level: 3_951,
    streetRep: 54_321,
    softCurrency: 1_000_000,
    packTickets: 4_321,
    styleShards: 765_432,
    cosmeticCurrency: 123_456,
    packPity: 9,
    deckSlots: 12,
    ownedCardIds: [futureCardId],
    discoveredCardIds: [futureCardId],
    ownedVariants: [futureVariantId],
    equippedVariants: { [futureCardId]: futureVariantId },
    cardProgression: { [futureCardId]: cardProgress },
    savedDecks: [savedDeck],
  });

  await ensurePlayer(clerkUserId);
  await getPlayerBootstrap(clerkUserId);
  await ensurePlayer(clerkUserId);

  const profile = await profileFor(clerkUserId);
  assert.deepEqual(
    {
      xp: profile.xp,
      level: profile.level,
      streetRep: profile.streetRep,
      softCurrency: profile.softCurrency,
      packTickets: profile.packTickets,
      styleShards: profile.styleShards,
      cosmeticCurrency: profile.cosmeticCurrency,
      packPity: profile.packPity,
      deckSlots: profile.deckSlots,
    },
    {
      xp: 987_654,
      level: 3_951,
      streetRep: 54_321,
      softCurrency: 1_000_000,
      packTickets: 4_321,
      styleShards: 765_432,
      cosmeticCurrency: 123_456,
      packPity: 9,
      deckSlots: 12,
    },
  );
  assert.deepEqual(profile.ownedCardIds, [futureCardId]);
  assert.ok(profile.discoveredCardIds.includes(futureCardId));
  assert.deepEqual(profile.ownedVariants, [futureVariantId]);
  assert.deepEqual(profile.equippedVariants, {
    [futureCardId]: futureVariantId,
  });
  assert.deepEqual(profile.cardProgression[futureCardId], cardProgress);
  assert.deepEqual(profile.savedDecks, [savedDeck]);
});

test("overlapping bootstrap, pack, mission, and shop retries conserve one locked wallet", async (t) => {
  const clerkUserId = `economy-rollout-race-${randomUUID()}`;
  cleanup(t, clerkUserId);
  const futureCardId = "future-race-card";
  const initial = {
    softCurrency: 5_000,
    packTickets: 3,
    styleShards: 700,
    packPity: 8,
  };
  const missionReward = 137;
  const missionKey = "rollout-conservation-credit";
  const packKey = randomUUID();
  const shopKey = randomUUID();

  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ...initial,
    ownedCardIds: [futureCardId],
    discoveredCardIds: [futureCardId],
    collectionProgress: 1,
  });
  await db.insert(playerMissionsTable).values({
    clerkUserId,
    missionKey,
    cadence: "permanent",
    title: "Rollout conservation",
    description: "A persisted pre-rollout credit.",
    progress: 1,
    goal: 1,
    rewardCurrency: "softCurrency",
    rewardAmount: missionReward,
  });

  const packInput = {
    idempotencyKey: packKey,
    paymentMethod: "ticket" as const,
  };
  const shopInput = {
    idempotencyKey: shopKey,
    itemId: "ticket" as const,
  };
  const results = await Promise.all([
    getPlayerBootstrap(clerkUserId),
    ensurePlayer(clerkUserId),
    openStreetPackForPlayer(clerkUserId, packInput),
    openStreetPackForPlayer(clerkUserId, packInput),
    claimMissionReward(clerkUserId, missionKey),
    claimMissionReward(clerkUserId, missionKey),
    purchaseShopItem(clerkUserId, shopInput),
    purchaseShopItem(clerkUserId, shopInput),
  ]);

  const packResults = [results[2], results[3]];
  const missionResults = [results[4], results[5]];
  const shopResults = [results[6], results[7]];
  assert.equal(packResults[0].opening.id, packResults[1].opening.id);
  assert.equal(packResults.filter((result) => !result.alreadyOpened).length, 1);
  assert.equal(missionResults.filter((result) => result.claimed).length, 1);
  assert.equal(shopResults.filter((result) => !result.alreadyPurchased).length, 1);
  assert.deepEqual(shopResults[0].receipt, shopResults[1].receipt);
  assert.equal(packResults[0].opening.pityBefore, initial.packPity);

  const opening = packResults[0].opening;
  const packSoftCurrency = opening.rewards
    .filter((reward) => reward.kind === "softCurrency")
    .reduce((sum, reward) => sum + reward.amount, 0);
  const packStyleShards = opening.rewards
    .filter((reward) => reward.kind === "styleShards")
    .reduce((sum, reward) => sum + reward.amount, 0);
  const rewardedCards = opening.rewards
    .filter((reward) => reward.kind === "card" && reward.cardId)
    .map((reward) => reward.cardId as string);
  const rewardedVariants = opening.rewards
    .filter((reward) => reward.kind === "variant" && reward.variantId)
    .map((reward) => reward.variantId as string);

  const profile = await profileFor(clerkUserId);
  assert.equal(
    profile.softCurrency,
    initial.softCurrency -
      shopResults[0].receipt.cost +
      missionReward +
      packSoftCurrency,
  );
  assert.equal(profile.packTickets, initial.packTickets);
  assert.equal(profile.styleShards, initial.styleShards + packStyleShards);
  assert.equal(profile.packPity, opening.pityAfter);
  assert.ok(profile.ownedCardIds.includes(futureCardId));
  for (const cardId of rewardedCards) {
    assert.ok(profile.ownedCardIds.includes(cardId));
    assert.ok(profile.discoveredCardIds.includes(cardId));
  }
  for (const variantId of rewardedVariants) {
    assert.ok(profile.ownedVariants.includes(variantId));
  }

  const [packClaimCount] = await db
    .select({ value: count() })
    .from(playerPackOpeningsTable)
    .where(
      and(
        eq(playerPackOpeningsTable.clerkUserId, clerkUserId),
        eq(playerPackOpeningsTable.idempotencyKey, packKey),
      ),
    );
  const [shopClaimCount] = await db
    .select({ value: count() })
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, clerkUserId),
        eq(
          playerCollectionClaimsTable.milestoneKey,
          `shop:${shopKey}`,
        ),
      ),
    );
  const [mission] = await db
    .select()
    .from(playerMissionsTable)
    .where(
      and(
        eq(playerMissionsTable.clerkUserId, clerkUserId),
        eq(playerMissionsTable.missionKey, missionKey),
      ),
    );
  assert.equal(packClaimCount.value, 1);
  assert.equal(shopClaimCount.value, 1);
  assert.ok(mission?.claimedAt);
});

test("pack history keeps legacy and current ten-pulls distinguishable after rollout", async (t) => {
  const clerkUserId = `economy-rollout-history-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
  });
  const common = {
    clerkUserId,
    paymentMethod: "ticket",
    cost: 10,
    rewards: [],
    pityBefore: 0,
    pityAfter: 0,
  };
  const persisted = await db
    .insert(playerPackOpeningsTable)
    .values([
      {
        ...common,
        idempotencyKey: randomUUID(),
        oddsVersion: "street-pack-ten-v1",
      },
      {
        ...common,
        idempotencyKey: randomUUID(),
        oddsVersion: "street-pack-ten-v2",
      },
    ])
    .returning();

  const serialized = persisted.map((opening: PlayerPackOpeningRecord) =>
    serializePackOpening(opening),
  );
  assert.deepEqual(
    serialized.map(({ oddsVersion, pullCount }) => ({
      oddsVersion,
      pullCount,
    })),
    [
      { oddsVersion: "street-pack-ten-v1", pullCount: 10 },
      { oddsVersion: "street-pack-ten-v2", pullCount: 10 },
    ],
  );
});