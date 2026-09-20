import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  playerMatchesTable,
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