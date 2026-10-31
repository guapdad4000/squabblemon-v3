import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "../app";
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
  assert.equal(results[0].opening.rewards.length, 6);
  assert.equal(results[0].opening.oddsVersion, 'street-pack-v7');
  assert.deepEqual(results[0].opening, results[1].opening);
  assert.equal(new Set(results[0].opening.rewards.slice(0,5).map(reward => reward.cardId)).size,5);
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

test("Collection Road duplicates grant 5 shards", async (t) => {
  const clerkUserId = `road-duplicate-${randomUUID()}`;
  const milestone = COLLECTION_ROAD[0];
  const startingCards = [
    milestone.reward.cardId!,
    ...cardCatalog.filter(card => card.catalogId !== milestone.reward.cardId)
      .slice(0, milestone.threshold - 1).map(card => card.catalogId),
  ];
  await db.insert(playerProfilesTable).values({
    clerkUserId, onboardingStep: "complete", ownedCardIds: startingCards,
    discoveredCardIds: startingCards, collectionProgress: startingCards.length,
  });
  t.after(async () => {
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  const result = await claimCollectionRoadForPlayer(clerkUserId, milestone);
  const [profile] = await db.select({ styleShards: playerProfilesTable.styleShards })
    .from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(result.reward.duplicateShards, 5);
  assert.equal(profile.styleShards, 5);
});

test("Collection Road never raises deck slots above 24", async (t) => {
  const clerkUserId = `road-slot-cap-${randomUUID()}`;
  const milestone = COLLECTION_ROAD.find(item => item.id === "full-roster")!;
  await db.insert(playerProfilesTable).values({
    clerkUserId, onboardingStep: "complete", ownedCardIds: allCardIdsForRoad(),
    discoveredCardIds: allCardIdsForRoad(), collectionProgress: cardCatalog.length,
    deckSlots: 23,
  });
  t.after(async () => {
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  await claimCollectionRoadForPlayer(clerkUserId, milestone);
  const [profile] = await db.select({ deckSlots: playerProfilesTable.deckSlots })
    .from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(profile.deckSlots, 24);
});

function allCardIdsForRoad() {
  return cardCatalog.map(card => card.catalogId);
}

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

test('weekly banner retries recover the original receipt across rotation without another charge or pity change', async t => {
  let now = Date.parse('2026-10-25T23:59:59.999Z');
  t.mock.method(Date, 'now', () => now);
  const clerkUserId = `banner-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId, onboardingStep: 'complete', packTickets: 3, packPity: 8 });
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  await assert.rejects(openStreetPackForPlayer(clerkUserId, { idempotencyKey: randomUUID(), paymentMethod: 'ticket', bannerId: 'missing' }), error => error instanceof EconomyTransactionError && error.status === 400);
  const request = { idempotencyKey: randomUUID(), paymentMethod: 'ticket' as const, bannerId: 'inmates', bannerOccurrenceId: 'inmates:2026-10-19' };
  const first = await openStreetPackForPlayer(clerkUserId, request);
  assert.equal(first.opening.oddsVersion, 'street-pack-v7:banner-inmates-v2:week-2026-10-19');
  now = Date.parse('2026-10-26T00:00:00Z');
  const retries = await Promise.all([openStreetPackForPlayer(clerkUserId, request), openStreetPackForPlayer(clerkUserId, request)]);
  for (const retry of retries) {
    assert.deepEqual(retry.opening, first.opening);
    assert.equal(retry.alreadyOpened, true);
  }
  await assert.rejects(openStreetPackForPlayer(clerkUserId, { ...request, idempotencyKey: randomUUID() }), error => error instanceof EconomyTransactionError && error.status === 400);
  const [afterRetry] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(afterRetry.packTickets, 2);
  assert.equal(afterRetry.packPity, first.opening.pityAfter);
  // All themes share the existing style counter; a weekly reset cannot reset pity.
  const next = await openStreetPackForPlayer(clerkUserId, { ...request, idempotencyKey: randomUUID(), bannerId: 'oz', bannerOccurrenceId: 'oz:2026-10-26' });
  assert.equal(next.opening.pityBefore, first.opening.pityAfter);
  now = Date.parse('2026-11-16T00:00:00Z');
  // The same theme returning does not revive an unpaid request from its old week.
  await assert.rejects(openStreetPackForPlayer(clerkUserId, { ...request, idempotencyKey: randomUUID() }), error => error instanceof EconomyTransactionError && error.status === 400);
  assert.deepEqual((await openStreetPackForPlayer(clerkUserId, request)).opening, first.opening);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(profile.packTickets, 1);
  assert.equal(profile.packPity, next.opening.pityAfter);
});

test('legacy active-theme requests still work and existing v1 receipts remain recoverable', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-19T00:00:00Z'));
  const clerkUserId = `banner-legacy-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId, onboardingStep: 'complete', packTickets: 1 });
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  const current = await openStreetPackForPlayer(clerkUserId, { idempotencyKey: randomUUID(), paymentMethod: 'ticket', bannerId: 'inmates' });
  assert.equal(current.opening.oddsVersion, 'street-pack-v7:banner-inmates-v2:week-2026-10-19');
  const [legacy] = await db.insert(playerPackOpeningsTable).values({ clerkUserId, idempotencyKey: randomUUID(), oddsVersion: 'street-pack-v7:banner-red-blue-v1', paymentMethod: 'ticket', cost: 1, rewards: current.opening.rewards, pityBefore: 0, pityAfter: 1 }).returning();
  const retry = await openStreetPackForPlayer(clerkUserId, { idempotencyKey: legacy.idempotencyKey, paymentMethod: 'ticket', bannerId: 'red-blue' });
  assert.equal(retry.alreadyOpened, true);
  assert.deepEqual(retry.opening, legacy);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(profile.packTickets, 0);
});


test('HTTP banner transport retains occurrence guards and supplies an uncached server clock', async t => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const clerkUserId = `banner-http-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({ clerkUserId, onboardingStep: 'complete', packTickets: 2 });
  const server = createApp((req, _res, next) => {
    const auth = Object.assign(() => ({ userId: clerkUserId, sessionId: 'banner-test', tokenType: 'session_token', isAuthenticated: true }), { [Symbol.for('@clerk/express.auth')]: true });
    Object.assign(req, { auth });
    next();
  }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const welcome = await fetch(`${origin}/player/packs/welcome`);
  assert.equal(welcome.status, 200);
  assert.equal(welcome.headers.get('cache-control'), 'no-store');
  assert.equal((await welcome.json() as { serverNow: number }).serverNow, now);
  const input = { idempotencyKey: randomUUID(), paymentMethod: 'ticket', bannerId: 'inmates', bannerOccurrenceId: 'inmates:2026-11-16' };
  const post = (body: typeof input) => fetch(`${origin}/player/packs/open`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const stale = await post(input);
  assert.equal(stale.status, 400, 'the generated request parser must not strip the occurrence guard');
  await stale.arrayBuffer();
  const [uncharged] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.equal(uncharged.packTickets, 2);
  const accepted = await post({ ...input, bannerOccurrenceId: 'inmates:2026-10-19' });
  assert.equal(accepted.status, 200);
  const result = await accepted.json() as { opening: { oddsVersion: string; pullCount: number }; bootstrap: { profile: { packTickets: number } } };
  assert.equal(result.opening.oddsVersion, 'street-pack-v7:banner-inmates-v2:week-2026-10-19');
  assert.equal(result.opening.pullCount, 1);
  assert.equal(result.bootstrap.profile.packTickets, 1);
});
