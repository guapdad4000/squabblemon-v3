import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  playerMatchesTable,
  playerProfilesTable,
} from "@workspace/db";
import { hasVerifiedTutorialMatch } from "./playerState";

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