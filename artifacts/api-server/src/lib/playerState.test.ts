import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  playerMatchesTable,
  playerPackOpeningsTable,
  playerProfilesTable,
} from "@workspace/db";
import { validateSavedDeck } from "@workspace/squabblemon-engine/data";
import { CITY_NEVER_SLEEPS_CATALOG_IDS, ensurePlayer, hasVerifiedTutorialMatch } from "./playerState";

test("only a completed tutorial fade unlocks tutorial advancement", async (t) => {
  const clerkUserId = `tutorial-guard-${randomUUID()}`;
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "tutorial",
  });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  assert.equal(await hasVerifiedTutorialMatch(clerkUserId), false);

  const [activeMatch] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId,
      mode: "tutorial",
      playerDeckId: "vibes",
      rivalDeckId: "combo",
    })
    .returning({ id: playerMatchesTable.id });

  assert.equal(await hasVerifiedTutorialMatch(clerkUserId), false);

  await db
    .update(playerMatchesTable)
    .set({
      outcome: "win",
      rounds: 6,
      districtsWon: 2,
      completedAt: new Date(),
    })
    .where(eq(playerMatchesTable.id, activeMatch.id));

  assert.equal(await hasVerifiedTutorialMatch(clerkUserId), true);
});

test("normalization preserves legacy ownership and earned moves without new catalog grants", async (t) => {
  const clerkUserId = `card-progress-baseline-${randomUUID()}`;
  const ownedCardIds = ["cornball", "snow-bunny", ...CITY_NEVER_SLEEPS_CATALOG_IDS];
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ownedCardIds,
    cardProgression: {
      cornball: { xp: 120, level: 99 },
      "not-owned": { xp: 900, level: 4 },
    },
    savedDecks: [{
      id: "saved-deck",
      name: "Saved Gang",
      cardIds: ownedCardIds,
      heroCardId: "cornball",
    }],
  });
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });

  await ensurePlayer(clerkUserId);
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.ok(profile);
  assert.deepEqual(profile.ownedCardIds, ownedCardIds);
  assert.deepEqual(profile.cardProgression, {
    cornball: { xp: 120, level: 2, moveTier: 1 },
    "snow-bunny": { xp: 0, level: 1, moveTier: 0 },
    ...Object.fromEntries(CITY_NEVER_SLEEPS_CATALOG_IDS.map((id) => [id, { xp: 0, level: 1, moveTier: 0 }])),
  });
  assert.deepEqual(profile.savedDecks[0]?.cardIds, ownedCardIds.slice(0, 10));
  await ensurePlayer(clerkUserId);
  const [again] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.deepEqual(again.ownedCardIds, ownedCardIds);
  assert(validateSavedDeck(
    ["barber-bro", "bottle-girl", "sneaker-reseller", "church-auntie", "landlord", "car-meet-kid", "promoter", "nail-tech", "og-uncle", "delivery-demon"],
    again.ownedCardIds,
    "barber-bro",
  ).valid);
});

test("new profiles earn their starter foundation through onboarding without receiving the expansion catalog", async (t) => {
  const clerkUserId = `city-never-sleeps-new-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  await ensurePlayer(clerkUserId);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.deepEqual(profile.ownedCardIds, []);
  assert.deepEqual(profile.discoveredCardIds, []);
});

test("profile refresh preserves cards and deck slots from a newer catalog", async t => {
  const clerkUserId = 'future-catalog-' + randomUUID();
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  const future = 'next-release-character';
  const cardIds = ['cornball', future, 'kyle', 'stockz'];
  const progress = { xp: 450, level: 3, moveTier: 1 };
  const deck = { id: 'preserved', name: 'My Gang', deckSize: 10, cardIds, heroCardId: future, recipeId: null };
  await db.insert(playerProfilesTable).values({ clerkUserId, ownedCardIds: cardIds,
    discoveredCardIds: [future], cardProgression: { [future]: progress },
    savedDecks: [deck], ownedVariants: [future + ':chrome'], equippedVariants: { [future]: future + ':chrome' } });
  await ensurePlayer(clerkUserId);
  await ensurePlayer(clerkUserId);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.deepEqual(profile.ownedCardIds, cardIds);
  assert(profile.discoveredCardIds.includes(future));
  assert.deepEqual(profile.savedDecks, [deck]);
  assert.deepEqual(profile.cardProgression[future], progress);
  assert.equal(profile.equippedVariants[future], future + ':chrome');
  assert.equal(validateSavedDeck(cardIds, profile.ownedCardIds, future).valid, false, 'Unavailable cards remain unplayable without deleting their save');
});

test("saved gacha card receipts restore missing ownership without charging or replaying currencies", async t => {
  const clerkUserId = 'receipt-recovery-' + randomUUID();
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  await db.insert(playerProfilesTable).values({ clerkUserId, ownedCardIds: ['cornball'], softCurrency: 75, packTickets: 2, styleShards: 10 });
  await db.insert(playerPackOpeningsTable).values({ clerkUserId, idempotencyKey: randomUUID(), oddsVersion: 'street-pack-v5', paymentMethod: 'ticket', cost: 1, pityBefore: 0, pityAfter: 1,
    rewards: [
      ...['kyle', 'stockz'].map(cardId => ({ kind: 'card' as const, cardId, variantId: null, name: cardId, rarity: 'Rare', isNew: true, amount: 1 })),
      { kind: 'softCurrency', cardId: null, variantId: null, name: 'Clout', rarity: null, isNew: false, amount: 100 },
      { kind: 'styleShards', cardId: 'hooper', variantId: null, name: 'Duplicate', rarity: 'Rare', isNew: false, amount: 25 },
    ] });
  await ensurePlayer(clerkUserId);
  await ensurePlayer(clerkUserId);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.deepEqual([...profile.ownedCardIds].sort(), ['cornball', 'kyle', 'stockz']);
  assert(profile.discoveredCardIds.includes('kyle') && profile.discoveredCardIds.includes('stockz'));
  assert.equal(profile.collectionProgress, 3);
  assert.equal(profile.softCurrency, 75);
  assert.equal(profile.packTickets, 2);
  assert.equal(profile.styleShards, 10);
});

test("Light leader promotions preserve existing copies, saved decks, training and cosmetics", async t => {
  const clerkUserId = 'light-promotion-' + randomUUID();
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  const cardIds = ['church-auntie', 'night-shift-medic', 'crossing-guard', 'leroy', 'foodz', 'wifey', 'cornball', 'kyle', 'stockz', 'dr-fade'];
  const savedDeck = { id: 'light-crew', name: 'My Light Crew', cardIds, heroCardId: 'church-auntie', deckSize: 10, recipeId: null };
  const progression = { 'church-auntie': { xp: 2800, level: 8, moveTier: 3 }, 'night-shift-medic': { xp: 1000, level: 5, moveTier: 2 } };
  const variants = ['church-auntie:chrome', 'night-shift-medic:chrome'];
  await db.insert(playerProfilesTable).values({ clerkUserId, onboardingStep: 'complete',
    ownedCardIds: cardIds, discoveredCardIds: cardIds, savedDecks: [savedDeck], cardProgression: progression,
    ownedVariants: variants, equippedVariants: { 'church-auntie': variants[0], 'night-shift-medic': variants[1] },
    softCurrency: 725, packTickets: 9, styleShards: 88 });
  // Historical Rare receipts remain valid after the catalog becomes Epic.
  await db.insert(playerPackOpeningsTable).values({ clerkUserId, idempotencyKey: randomUUID(),
    oddsVersion: 'street-pack-v5', paymentMethod: 'ticket', cost: 1, pityBefore: 0, pityAfter: 1,
    rewards: cardIds.slice(0, 2).map(cardId => ({ kind: 'card' as const, cardId, variantId: null,
      name: cardId, rarity: 'Rare', isNew: true, amount: 1 })) });
  await ensurePlayer(clerkUserId);
  await ensurePlayer(clerkUserId);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.deepEqual(profile.ownedCardIds, cardIds);
  assert.deepEqual(profile.savedDecks, [savedDeck]);
  for (const id of ['church-auntie', 'night-shift-medic'] as const) {
    assert.deepEqual(profile.cardProgression[id], progression[id]);
  }
  assert.deepEqual(profile.ownedVariants, variants);
  assert.deepEqual(profile.equippedVariants, { 'church-auntie': variants[0], 'night-shift-medic': variants[1] });
  assert.deepEqual([profile.softCurrency, profile.packTickets, profile.styleShards], [725, 9, 88]);
  assert(validateSavedDeck(cardIds, profile.ownedCardIds, 'church-auntie').valid);
});
