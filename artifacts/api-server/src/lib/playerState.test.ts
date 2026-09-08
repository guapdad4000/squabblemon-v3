import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  playerMatchesTable,
  playerProfilesTable,
} from "@workspace/db";
import { ensurePlayer, hasVerifiedTutorialMatch } from "./playerState";

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

test("existing owned cards receive normalized baseline progression without changing inventory", async (t) => {
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
  assert.deepEqual(profile.ownedCardIds, ownedCardIds);
  assert.deepEqual(profile.cardProgression, {
    cornball: { xp: 120, level: 2 },
    "snow-bunny": { xp: 0, level: 1 },
  });
  assert.deepEqual(profile.savedDecks[0]?.cardIds, ownedCardIds);
});