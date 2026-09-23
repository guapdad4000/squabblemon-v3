import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  db,
  challengeRunsTable,
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
import {
  createMatch,
  playCard,
  type Match,
} from "@workspace/squabblemon-engine/gameEngine";
import { createCardProgressionSnapshot } from "./cardProgression";
import { encounterFor } from "@workspace/squabblemon-engine/challenge";

function matchWithPlayedPlayerCard(): Match {
  const initial = createMatch("block", "slide");
  const card = initial.playerHand[0]!;
  return playCard(initial, "player", card.instanceId, 0);
}

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

test("simultaneous fade completions return one persisted reward and credit it once", async (t) => {
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
      description: "Finish one fade.",
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
      description: "Win one fade.",
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
      description: "Finish five fades.",
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
      playerCardProgressionSnapshot: createCardProgressionSnapshot([], [], {}),
    })
    .returning();

  const results = await Promise.all([
    completeStandardMatchReward({
      clerkUserId,
      matchId: match.id,
      outcome: "win",
      districtsWon: 3,
      verifiedMatch: createMatch("block", "slide"),
    }),
    completeStandardMatchReward({
      clerkUserId,
      matchId: match.id,
      outcome: "loss",
      districtsWon: 0,
      verifiedMatch: createMatch("block", "slide"),
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
  assert.equal(profile.softCurrency, 80);
  assert.equal((await missionFor(clerkUserId, "daily-show-up")).progress, 1);
  assert.equal((await missionFor(clerkUserId, "weekly-main-character")).progress, 1);
});

test("simultaneous completions grant participating card XP once and persist the retry result", async (t) => {
  const clerkUserId = `card-xp-retry-${randomUUID()}`;
  cleanup(t, clerkUserId);
  const verifiedMatch = matchWithPlayedPlayerCard();
  const playedCardId = verifiedMatch.boards.flat().find((card) => card.owner === "player")!.cardId;
  const ownedCardIds = ["cornball", "snow-bunny", "all-jokes-roaster", "rastamon", "wifey", "officer-oink", "baby-momma"];
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ownedCardIds,
    cardProgression: { [playedCardId]: { xp: 90, level: 1 } },
  });
  const [match] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId,
      mode: "practice",
      playerDeckId: "block",
      rivalDeckId: "slide",
      playerCardProgressionSnapshot: createCardProgressionSnapshot(
        ownedCardIds,
        ownedCardIds,
        { [playedCardId]: { xp: 90, level: 1 } },
      ),
    })
    .returning();

  const results = await Promise.all([
    completeStandardMatchReward({
      clerkUserId,
      matchId: match.id,
      outcome: "win",
      districtsWon: 1,
      verifiedMatch,
    }),
    completeStandardMatchReward({
      clerkUserId,
      matchId: match.id,
      outcome: "win",
      districtsWon: 1,
      verifiedMatch,
    }),
  ]);

  assert.equal(results.filter((result) => result.completed).length, 1);
  assert.deepEqual(results[0]!.cardXpRewards, results[1]!.cardXpRewards);
  assert.deepEqual(results[0]!.cardXpRewards, [{
    cardId: playedCardId,
    xpGained: 30,
    previousXp: 90,
    previousLevel: 1,
    xp: 120,
    level: 2,
  }]);
  const profile = await profileFor(clerkUserId);
  assert.deepEqual(profile.cardProgression[playedCardId], { xp: 120, level: 2, moveTier: 0 });
});

test("challenge draw pays nothing and a later verified win advances the same road once", async (t) => {
  const clerkUserId = `challenge-reward-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
  });
  const drawMatchId = randomUUID();
  const [run] = await db.insert(challengeRunsTable).values({
    clerkUserId,
    seed: 77,
    entryDate: "2026-09-23",
    entryNumber: 1,
    crewSnapshot: { deckId: "block", cards: [], capturedAt: new Date().toISOString(), rulesVersion: 1 },
    encounterSnapshot: encounterFor(77, 0, drawMatchId),
    checkpoints: [],
    transcripts: [],
  }).returning();
  await db.insert(playerMatchesTable).values({
    id: drawMatchId,
    clerkUserId,
    challengeRunId: run.id,
    mode: "practice",
    playerDeckId: "block",
    rivalDeckId: "slide",
  });

  const draw = await completeStandardMatchReward({
    clerkUserId,
    matchId: drawMatchId,
    outcome: "draw",
    districtsWon: 1,
    verifiedMatch: createMatch("block", "slide"),
    moves: [{ cardInstanceId: null, lane: null, squabble: false }],
    challengeRunId: run.id,
  });
  assert.equal(draw.completed, true);
  assert.deepEqual(
    [draw.match.rewardXp, draw.match.rewardStreetRep, draw.match.rewardSoftCurrency, draw.match.rewardPackTickets],
    [0, 0, 0, 0],
  );
  let [persistedRun] = await db.select().from(challengeRunsTable).where(eq(challengeRunsTable.id, run.id));
  assert.equal(persistedRun.status, "active");
  assert.equal(persistedRun.encounterIndex, 0);
  assert.equal((persistedRun.encounterSnapshot as { playerMatchId?: string }).playerMatchId, "");

  const winMatchId = randomUUID();
  await db.update(challengeRunsTable).set({
    encounterSnapshot: encounterFor(77, 0, winMatchId),
  }).where(eq(challengeRunsTable.id, run.id));
  await db.insert(playerMatchesTable).values({
    id: winMatchId,
    clerkUserId,
    challengeRunId: run.id,
    mode: "practice",
    playerDeckId: "block",
    rivalDeckId: "slide",
  });
  const winInput = {
    clerkUserId,
    matchId: winMatchId,
    outcome: "win" as const,
    districtsWon: 2,
    verifiedMatch: createMatch("block", "slide"),
    moves: [{ cardInstanceId: null, lane: null, squabble: false }],
    challengeRunId: run.id,
  };
  const [win, duplicate] = await Promise.all([
    completeStandardMatchReward(winInput),
    completeStandardMatchReward(winInput),
  ]);
  assert.equal([win, duplicate].filter(result => result.completed).length, 1);
  [persistedRun] = await db.select().from(challengeRunsTable).where(eq(challengeRunsTable.id, run.id));
  assert.equal(persistedRun.status, "active");
  assert.equal(persistedRun.wins, 1);
  assert.equal(persistedRun.encounterIndex, 1);
  assert.equal((persistedRun.encounterSnapshot as { index: number }).index, 1);
  assert.deepEqual(
    (persistedRun.transcripts as Array<{ outcome: string }>).map(item => item.outcome),
    ["draw", "win"],
  );
});

test("a legacy active fade rebuilds its snapshot from the server-owned roster", async (t) => {
  const clerkUserId = `card-xp-legacy-${randomUUID()}`;
  cleanup(t, clerkUserId);
  const verifiedMatch = matchWithPlayedPlayerCard();
  const playedCardId = verifiedMatch.boards.flat().find((card) => card.owner === "player")!.cardId;
  const ownedCardIds = ["cornball", "snow-bunny", "all-jokes-roaster", "rastamon", "wifey", "officer-oink", "baby-momma"];
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ownedCardIds,
  });
  const [match] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId,
      mode: "practice",
      playerDeckId: "block",
      rivalDeckId: "slide",
      playerCardProgressionSnapshot: null,
    })
    .returning();

  const result = await completeStandardMatchReward({
    clerkUserId,
    matchId: match.id,
    outcome: "loss",
    districtsWon: 0,
    verifiedMatch,
  });
  assert.deepEqual(result.cardXpRewards, [{
    cardId: playedCardId,
    xpGained: 20,
    previousXp: 0,
    previousLevel: 1,
    xp: 20,
    level: 1,
  }]);
  assert.equal(result.match.rewardSoftCurrency, 20);
});

test("starter and mission retries each apply one profile credit", async (t) => {
  const clerkUserId = `claim-retry-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "reward",
    xp: 150,
    level: 1,
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
  assert.equal(profile.xp, 250);
  assert.equal(profile.level, 2);

  const missionResults = await Promise.all([
    claimMissionReward(clerkUserId, "rookie-road"),
    claimMissionReward(clerkUserId, "rookie-road"),
  ]);
  assert.equal(missionResults.filter((result) => result.claimed).length, 1);
  profile = await profileFor(clerkUserId);
  assert.equal(profile.packTickets, 2);
  assert.equal(profile.xp, 250);
  assert.equal(profile.level, 2);
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
    description: "Finish one fade.",
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

test("a cadence reset racing fade completion preserves current-period progress", async (t) => {
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
    description: "Finish one fade.",
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
      verifiedMatch: createMatch("block", "slide"),
    }),
  ]);
  assert.equal((await missionFor(clerkUserId, "daily-show-up")).progress, 1);
  assert.equal((await profileFor(clerkUserId)).xp, 25);
});
