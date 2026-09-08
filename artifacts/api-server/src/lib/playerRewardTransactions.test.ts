import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  db,
  playerMatchesTable,
  playerMissionsTable,
  playerProfilesTable,
} from "@workspace/db";
import {
  claimMissionReward,
  claimStarterReward,
  completeStandardMatchReward,
  PlayerRewardError,
  resetExpiredPlayerMissions,
} from "./playerRewardTransactions";

async function profileFor(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.ok(profile);
  return profile;
}

async function missionFor(clerkUserId: string, missionKey: string) {
  const [mission] = await db
    .select()
    .from(playerMissionsTable)
    .where(
      and(
        eq(playerMissionsTable.clerkUserId, clerkUserId),
        eq(playerMissionsTable.missionKey, missionKey),
      ),
    );
  assert.ok(mission);
  return mission;
}

function cleanup(t: test.TestContext, clerkUserId: string) {
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });
}

test("simultaneous match completions return one persisted reward and credit it once", async (t) => {
  const clerkUserId = `match-retry-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
  });
  await db.insert(playerMissionsTable).values([
    {
      clerkUserId,
      missionKey: "daily-show-up",
      cadence: "daily",
      title: "Show Up",
      description: "Finish one match.",
      goal: 1,
      rewardCurrency: "softCurrency",
      rewardAmount: 100,
      resetAt: new Date(Date.now() + 86_400_000),
    },
    {
      clerkUserId,
      missionKey: "daily-take-room",
      cadence: "daily",
      title: "Take A Room",
      description: "Win one match.",
      goal: 1,
      rewardCurrency: "softCurrency",
      rewardAmount: 150,
      resetAt: new Date(Date.now() + 86_400_000),
    },
    {
      clerkUserId,
      missionKey: "weekly-main-character",
      cadence: "weekly",
      title: "Main Character Week",
      description: "Finish five matches.",
      goal: 5,
      rewardCurrency: "packTickets",
      rewardAmount: 2,
      resetAt: new Date(Date.now() + 604_800_000),
    },
  ]);
  const [match] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId,
      mode: "practice",
      playerDeckId: "block",
      rivalDeckId: "slide",
    })
    .returning();

  const results = await Promise.all([
    completeStandardMatchReward({
      clerkUserId,
      matchId: match.id,
      outcome: "win",
      districtsWon: 3,
    }),
    completeStandardMatchReward({
      clerkUserId,
      matchId: match.id,
      outcome: "loss",
      districtsWon: 0,
    }),
  ]);
  assert.equal(results.filter((result) => result.completed).length, 1);
  assert.deepEqual(
    results.map(({ match: persisted }) => ({
      outcome: persisted.outcome,
      xp: persisted.rewardXp,
      currency: persisted.rewardSoftCurrency,
    })),
    Array(2).fill({
      outcome: results[0].match.outcome,
      xp: results[0].match.rewardXp,
      currency: results[0].match.rewardSoftCurrency,
    }),
  );
  const profile = await profileFor(clerkUserId);
  assert.equal(profile.xp, results[0].match.rewardXp);
  assert.equal(profile.softCurrency, results[0].match.rewardSoftCurrency);
  assert.equal((await missionFor(clerkUserId, "daily-show-up")).progress, 1);
  assert.equal((await missionFor(clerkUserId, "weekly-main-character")).progress, 1);
});

test("starter and mission retries each apply one profile credit", async (t) => {
  const clerkUserId = `claim-retry-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "reward",
  });
  await db.insert(playerMissionsTable).values({
    clerkUserId,
    missionKey: "rookie-road",
    cadence: "onboarding",
    title: "Rookie Road",
    description: "Finish onboarding.",
    progress: 1,
    goal: 1,
    rewardCurrency: "packTickets",
    rewardAmount: 1,
  });

  const starterResults = await Promise.all([
    claimStarterReward(clerkUserId),
    claimStarterReward(clerkUserId),
  ]);
  assert.deepEqual(starterResults.sort(), [false, true]);
  let profile = await profileFor(clerkUserId);
  assert.equal(profile.softCurrency, 250);
  assert.equal(profile.packTickets, 1);

  const missionResults = await Promise.all([
    claimMissionReward(clerkUserId, "rookie-road"),
    claimMissionReward(clerkUserId, "rookie-road"),
  ]);
  assert.equal(missionResults.filter((result) => result.claimed).length, 1);
  profile = await profileFor(clerkUserId);
  assert.equal(profile.packTickets, 2);
  assert.ok((await missionFor(clerkUserId, "rookie-road")).claimedAt);
});

test("a cadence reset racing a claim cannot reopen an expired claimed mission", async (t) => {
  const clerkUserId = `claim-reset-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
  });
  await db.insert(playerMissionsTable).values({
    clerkUserId,
    missionKey: "daily-show-up",
    cadence: "daily",
    title: "Show Up",
    description: "Finish one match.",
    progress: 1,
    goal: 1,
    rewardCurrency: "softCurrency",
    rewardAmount: 100,
    claimedAt: new Date(Date.now() - 60_000),
    resetAt: new Date(Date.now() - 1_000),
  });

  const [, claim] = await Promise.allSettled([
    resetExpiredPlayerMissions(clerkUserId, new Date()),
    claimMissionReward(clerkUserId, "daily-show-up"),
  ]);
  if (claim.status === "rejected") {
    assert.ok(claim.reason instanceof PlayerRewardError);
    assert.equal(claim.reason.status, 400);
  } else {
    assert.equal(claim.value.claimed, false);
  }
  const mission = await missionFor(clerkUserId, "daily-show-up");
  assert.equal(mission.progress, 0);
  assert.equal(mission.claimedAt, null);
  assert.equal((await profileFor(clerkUserId)).softCurrency, 0);
});

test("a cadence reset racing match completion preserves current-period progress", async (t) => {
  const clerkUserId = `match-reset-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
  });
  await db.insert(playerMissionsTable).values({
    clerkUserId,
    missionKey: "daily-show-up",
    cadence: "daily",
    title: "Show Up",
    description: "Finish one match.",
    progress: 1,
    goal: 3,
    rewardCurrency: "softCurrency",
    rewardAmount: 100,
    resetAt: new Date(Date.now() - 1_000),
  });
  const [match] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId,
      mode: "practice",
      playerDeckId: "block",
      rivalDeckId: "slide",
    })
    .returning();

  await Promise.all([
    resetExpiredPlayerMissions(clerkUserId, new Date()),
    completeStandardMatchReward({
      clerkUserId,
      matchId: match.id,
      outcome: "loss",
      districtsWon: 0,
    }),
  ]);
  assert.equal((await missionFor(clerkUserId, "daily-show-up")).progress, 1);
  assert.equal((await profileFor(clerkUserId)).xp, 40);
});