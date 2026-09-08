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

test("only a completed tutorial match unlocks tutorial advancement", async (t) => {
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

test("existing profiles receive the idempotent City Never Sleeps grant during normalization", async (t) => {
  const clerkUserId = `card-progress-baseline-${randomUUID()}`;
  const ownedCardIds = ["cornball", "snow-bunny"];
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
      name: "Saved Crew",
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
  assert.deepEqual(profile.ownedCardIds, [...ownedCardIds, ...CITY_NEVER_SLEEPS_CATALOG_IDS]);
  assert.deepEqual(profile.cardProgression, {
    cornball: { xp: 120, level: 2 },
    "snow-bunny": { xp: 0, level: 1 },
    ...Object.fromEntries(CITY_NEVER_SLEEPS_CATALOG_IDS.map((id) => [id, { xp: 0, level: 1 }])),
  });
  assert.deepEqual(profile.savedDecks[0]?.cardIds, ownedCardIds);
  await ensurePlayer(clerkUserId);
  const [again] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.deepEqual(again.ownedCardIds, [...ownedCardIds, ...CITY_NEVER_SLEEPS_CATALOG_IDS]);
  assert(validateSavedDeck(
    ["barber-bro", "bottle-girl", "sneaker-reseller", "church-auntie", "landlord", "car-meet-kid", "promoter"],
    again.ownedCardIds,
    "barber-bro",
  ).valid);
});

test("new profiles receive and discover exactly the City Never Sleeps catalog grant", async (t) => {
  const clerkUserId = `city-never-sleeps-new-${randomUUID()}`;
  t.after(async () => { await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId)); });
  await ensurePlayer(clerkUserId);
  const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.deepEqual(profile.ownedCardIds, CITY_NEVER_SLEEPS_CATALOG_IDS);
  assert.deepEqual(profile.discoveredCardIds, CITY_NEVER_SLEEPS_CATALOG_IDS);
});