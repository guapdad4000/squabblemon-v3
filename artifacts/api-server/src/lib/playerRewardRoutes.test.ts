import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import {
  db,
  challengeRunsTable,
  playerMatchesTable,
  playerMissionsTable,
  playerProfilesTable,
} from "@workspace/db";
import { starterRecipes, catalogIdsToEngineIds } from "@workspace/squabblemon-engine/data";
import { createStoryMatch, replayMatchPrefix, canAffordSelection, type TranscriptMove } from "@workspace/squabblemon-engine/gameEngine";
import { CARD_BALANCE_VERSION } from "@workspace/squabblemon-engine/multiplayer";
import { createApp } from "../app";
import { createCardProgressionSnapshot } from "./cardProgression";

const clerkAuthBrand = Symbol.for("@clerk/express.auth");

function testAuth(clerkUserId: string): RequestHandler {
  return (req, _res, next) => {
    const auth = () => ({
      actor: undefined,
      debug: () => "",
      getToken: async () => null,
      has: () => false,
      isAuthenticated: true,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      sessionClaims: { sub: clerkUserId },
      sessionId: `test-session-${clerkUserId}`,
      tokenType: "session_token",
      userId: clerkUserId,
    });
    Object.assign(auth, { [clerkAuthBrand]: true });
    Object.assign(req, { auth });
    next();
  };
}

async function withPlayerApi<T>(
  clerkUserId: string,
  run: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createApp(testAuth(clerkUserId)).listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await response.json()) as Record<string, any>;
  assert.equal(response.status, 200, JSON.stringify(json));
  return json;
}

async function patchProfile(
  baseUrl: string,
  body: unknown,
  expectedStatus = 200,
) {
  const response = await fetch(`${baseUrl}/player/profile`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, any>;
  assert.equal(response.status, expectedStatus, JSON.stringify(json));
  return json;
}

async function profileFor(clerkUserId: string) {
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  assert.ok(profile);
  return profile;
}

function rewardCredits(response: Record<string, any>) {
  return {
    onboardingStep: response.profile.onboardingStep,
    starterRewardClaimed: response.profile.starterRewardClaimed,
    streetRep: response.profile.streetRep,
    xp: response.profile.xp,
    softCurrency: response.profile.softCurrency,
    packTickets: response.profile.packTickets,
  };
}

function cleanup(t: test.TestContext, clerkUserId: string) {
  t.after(async () => {
    await db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });
}

test("Straight to the Back extends JSONB checkpoints through round two and rejects changed history", async (t) => {
  const clerkUserId = `challenge-round-two-${randomUUID()}`;
  cleanup(t, clerkUserId);
  const recipe = starterRecipes[0];
  await db.insert(playerProfilesTable).values({
    clerkUserId, onboardingStep: "complete", starterDeckId: recipe.id,
    ownedCardIds: recipe.catalogCardIds,
  });
  await withPlayerApi(clerkUserId, async baseUrl => {
    const runResponse = await fetch(`${baseUrl}/player/challenges/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deckId: recipe.id }) });
    const run = await runResponse.json() as any;
    assert.equal(runResponse.status, 201, JSON.stringify(run));
    const startResponse = await fetch(`${baseUrl}/player/matches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "practice", playerDeckId: recipe.id, challengeRunId: run.id }) });
    const issued = await startResponse.json() as any;
    assert.equal(startResponse.status, 201, JSON.stringify(issued));
    const initial = createStoryMatch(issued.encounterSnapshot, catalogIdsToEngineIds(recipe.catalogCardIds), recipe.id, issued.abilityUpgradeSnapshot, issued.districtSnapshot);
    const moves: TranscriptMove[] = [{ cardInstanceId: null, lane: null, squabble: false, endTurn: true }];
    const url = `${baseUrl}/player/challenges/runs/${run.id}/checkpoint`;
    await postJson(url, { moves });
    const roundTwo = replayMatchPrefix(initial, moves);
    assert.equal(roundTwo.round, 2);
    const card = roundTwo.playerHand.find(card => canAffordSelection(roundTwo, 'player', card.instanceId, 0));
    assert.ok(card, 'Round two has an affordable card');
    moves.push({ cardInstanceId: card.instanceId, lane: 0, squabble: false, endTurn: false });
    await postJson(url, { moves });
    moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
    await postJson(url, { moves });
    assert.equal(replayMatchPrefix(initial, moves).round, 3);
    // Retrying an already accepted save is safe, regardless of key order.
    await postJson(url, { moves: moves.map(move => Object.fromEntries(Object.entries(move).reverse())) });
    const changed = structuredClone(moves);
    changed[0].squabble = true;
    const rejected = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ moves: changed }) });
    assert.equal(rejected.status, 400);
    assert.match(JSON.stringify(await rejected.json()), /extend the existing transcript/);
  });
});

test("HTTP challenge match start rejects story and tutorial modes without binding the run", async (t) => {
  const clerkUserId = `challenge-mode-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
  });
  const [run] = await db.insert(challengeRunsTable).values({
    clerkUserId,
    seed: 99,
    entryDate: "2026-09-23",
    entryNumber: 1,
    crewSnapshot: { deckId: "block", cards: [], capturedAt: new Date().toISOString(), rulesVersion: 1 },
    encounterSnapshot: { index: 0, seed: 99, boss: false, rivalDeckId: "slide", playerMatchId: "" },
    checkpoints: [],
    transcripts: [],
  }).returning();

  await withPlayerApi(clerkUserId, async (baseUrl) => {
    for (const mode of ["story", "tutorial"]) {
      const response = await fetch(`${baseUrl}/player/matches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          playerDeckId: "block",
          rivalDeckId: "slide",
          challengeRunId: run.id,
          ...(mode === "story" ? { storyNodeId: "welcome-to-the-block" } : {}),
        }),
      });
      assert.equal(response.status, 400);
      assert.match(JSON.stringify(await response.json()), /practice battle mode/);
    }
  });

  const bound = await db.select().from(playerMatchesTable)
    .where(eq(playerMatchesTable.challengeRunId, run.id));
  assert.equal(bound.length, 0);
});

test("HTTP profile update persists an owned catalog character avatar and preserves rewards and cosmetics", async (t) => {
  const clerkUserId = `route-avatar-owned-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    displayName: "Before",
    avatarKey: "cornball",
    onboardingStep: "complete",
    xp: 375,
    level: 2,
    streetRep: 19,
    softCurrency: 480,
    packTickets: 3,
    styleShards: 90,
    ownedCardIds: ["cornball", "rastamon"],
    ownedVariants: ["rastamon:tagged"],
    equippedVariants: { rastamon: "rastamon:tagged" },
    unlockedCosmeticIds: ["badge:after-hours", "mastery:cornball"],
    settings: {
      reducedMotion: false,
      turnTimerEnabled: true,
      cosmetics: {
        bannerCardId: "cornball",
        bannerFinish: "silver",
        stickers: ["cornball:smile"],
      },
    },
  });

  await withPlayerApi(clerkUserId, async (baseUrl) => {
    const response = await patchProfile(baseUrl, {
      avatarKey: "rastamon",
      displayName: "After",
      reducedMotion: true,
    });
    assert.equal(response.profile.avatarKey, "rastamon");
    assert.equal(response.profile.displayName, "After");

    const profile = await profileFor(clerkUserId);
    assert.equal(profile.avatarKey, "rastamon");
    assert.equal(profile.displayName, "After");
    assert.deepEqual(profile.settings, {
      reducedMotion: true,
      turnTimerEnabled: true,
      cosmetics: {
        bannerCardId: "cornball",
        bannerFinish: "silver",
        stickers: ["cornball:smile"],
      },
    });
    assert.deepEqual(profile.unlockedCosmeticIds, [
      "badge:after-hours",
      "mastery:cornball",
    ]);
    assert.deepEqual(profile.ownedVariants, ["rastamon:tagged"]);
    assert.deepEqual(profile.equippedVariants, {
      rastamon: "rastamon:tagged",
    });
    assert.deepEqual(
      {
        xp: profile.xp,
        level: profile.level,
        streetRep: profile.streetRep,
        softCurrency: profile.softCurrency,
        packTickets: profile.packTickets,
        styleShards: profile.styleShards,
      },
      {
        xp: 375,
        level: 2,
        streetRep: 19,
        softCurrency: 480,
        packTickets: 3,
        styleShards: 90,
      },
    );
  });
});

test("HTTP profile update rejects unknown and unowned avatar selections without partial writes", async (t) => {
  const clerkUserId = `route-avatar-rejected-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    displayName: "Untouched",
    avatarKey: "cornball",
    onboardingStep: "complete",
    softCurrency: 275,
    ownedCardIds: ["cornball"],
    unlockedCosmeticIds: ["badge:street-draft"],
    settings: {
      reducedMotion: false,
      turnTimerEnabled: true,
      cosmetics: { bannerCardId: "cornball" },
    },
  });

  await withPlayerApi(clerkUserId, async (baseUrl) => {
    const unknown = await patchProfile(
      baseUrl,
      {
        avatarKey: "constructor",
        displayName: "Should Not Save",
        reducedMotion: true,
      },
      400,
    );
    assert.match(unknown.error, /valid character avatar/i);

    let profile = await profileFor(clerkUserId);
    assert.equal(profile.avatarKey, "cornball");
    assert.equal(profile.displayName, "Untouched");
    assert.equal(profile.settings.reducedMotion, false);

    const unowned = await patchProfile(
      baseUrl,
      {
        avatarKey: "rastamon",
        displayName: "Still Should Not Save",
        turnTimerEnabled: false,
      },
      400,
    );
    assert.match(unowned.error, /unlock this character/i);

    profile = await profileFor(clerkUserId);
    assert.equal(profile.avatarKey, "cornball");
    assert.equal(profile.displayName, "Untouched");
    assert.deepEqual(profile.settings, {
      reducedMotion: false,
      turnTimerEnabled: true,
      cosmetics: { bannerCardId: "cornball" },
    });
    assert.equal(profile.softCurrency, 275);
    assert.deepEqual(profile.unlockedCosmeticIds, ["badge:street-draft"]);
  });
});

test("HTTP profile update permits unrelated changes when a legacy avatar is unchanged or omitted", async (t) => {
  const clerkUserId = `route-avatar-legacy-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    displayName: "Legacy",
    avatarKey: "retired-launch-avatar",
    onboardingStep: "complete",
    ownedCardIds: ["cornball"],
    settings: {
      reducedMotion: false,
      turnTimerEnabled: true,
      cosmetics: { stickers: ["cornball:star"] },
    },
  });

  await withPlayerApi(clerkUserId, async (baseUrl) => {
    const unchanged = await patchProfile(baseUrl, {
      avatarKey: "retired-launch-avatar",
      displayName: "Legacy Kept",
    });
    assert.equal(unchanged.profile.avatarKey, "retired-launch-avatar");
    assert.equal(unchanged.profile.displayName, "Legacy Kept");

    const omitted = await patchProfile(baseUrl, {
      turnTimerEnabled: false,
    });
    assert.equal(omitted.profile.avatarKey, "retired-launch-avatar");

    const profile = await profileFor(clerkUserId);
    assert.equal(profile.avatarKey, "retired-launch-avatar");
    assert.equal(profile.displayName, "Legacy Kept");
    assert.deepEqual(profile.settings, {
      reducedMotion: false,
      turnTimerEnabled: false,
      cosmetics: { stickers: ["cornball:star"] },
    });
  });
});

test("concurrent HTTP fade completions return one persisted reward and apply it once", async (t) => {
  const clerkUserId = `route-match-${randomUUID()}`;
  cleanup(t, clerkUserId);
  const playerRecipe = starterRecipes.find((recipe) => recipe.id === "block")!;
  const rivalRecipe = starterRecipes.find((recipe) => recipe.id === "slide")!;
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ownedCardIds: playerRecipe.catalogCardIds,
  });
  const [match] = await db
    .insert(playerMatchesTable)
    .values({
      clerkUserId,
      mode: "practice",
      playerDeckId: "block",
      rivalDeckId: "slide",
      playerCardProgressionSnapshot: createCardProgressionSnapshot(
        playerRecipe.cards,
        playerRecipe.catalogCardIds,
        {},
        false,
        rivalRecipe.cards,
      ),
    })
    .returning();
  const moves = Array.from({ length: 6 }, () => ({
    cardInstanceId: null,
    lane: null,
    squabble: false,
  }));

  await withPlayerApi(clerkUserId, async (baseUrl) => {
    const responses = await Promise.all([
      postJson(`${baseUrl}/player/matches/${match.id}/complete`, { moves }),
      postJson(`${baseUrl}/player/matches/${match.id}/complete`, { moves }),
    ]);
    assert.equal(
      responses.filter((response) => response.alreadyCompleted === false).length,
      1,
    );
    assert.deepEqual(responses[0].reward, responses[1].reward);

    const [persisted] = await db
      .select()
      .from(playerMatchesTable)
      .where(eq(playerMatchesTable.id, match.id));
    assert.ok(persisted?.completedAt);
    assert.equal(responses[0].reward.xp, persisted.rewardXp);
    assert.equal(
      responses[0].reward.softCurrency,
      persisted.rewardSoftCurrency,
    );
    const profile = await profileFor(clerkUserId);
    assert.equal(profile.xp, persisted.rewardXp);
    assert.equal(profile.softCurrency, persisted.rewardSoftCurrency);
  });
});

test("pending rewarded fades issued under old card rules are rejected without granting rewards", async (t) => {
  const clerkUserId = `route-stale-balance-${randomUUID()}`;
  cleanup(t, clerkUserId);
  const playerRecipe = starterRecipes.find((recipe) => recipe.id === "block")!;
  const rivalRecipe = starterRecipes.find((recipe) => recipe.id === "slide")!;
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
    ownedCardIds: playerRecipe.catalogCardIds,
  });
  const currentSnapshot = createCardProgressionSnapshot(
    playerRecipe.cards,
    playerRecipe.catalogCardIds,
    {},
    false,
    rivalRecipe.cards,
  );
  const [match] = await db.insert(playerMatchesTable).values({
    clerkUserId,
    mode: "practice",
    playerDeckId: "block",
    rivalDeckId: "slide",
    playerCardProgressionSnapshot: {
      ...currentSnapshot,
      balanceRulesVersion: CARD_BALANCE_VERSION - 1,
    },
  }).returning();
  const originalProfile = await profileFor(clerkUserId);
  const moves = Array.from({ length: 6 }, () => ({
    cardInstanceId: null,
    lane: null,
    squabble: false,
  }));

  await withPlayerApi(clerkUserId, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/player/matches/${match.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moves }),
    });
    const body = (await response.json()) as Record<string, any>;
    assert.equal(response.status, 409);
    assert.match(body.error, /older card balance.*start a new fade/i);

    const [persisted] = await db.select().from(playerMatchesTable)
      .where(eq(playerMatchesTable.id, match.id));
    assert.equal(persisted.completedAt, null);
    assert.equal(persisted.rewardXp, null);
    assert.equal(persisted.rewardSoftCurrency, null);
    const unchangedProfile = await profileFor(clerkUserId);
    assert.equal(unchangedProfile.xp, originalProfile.xp);
    assert.equal(unchangedProfile.softCurrency, originalProfile.softCurrency);
    assert.equal(unchangedProfile.packTickets, originalProfile.packTickets);
  });
});

test("concurrent HTTP starter claims return the same single-applied profile", async (t) => {
  const clerkUserId = `route-starter-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "reward",
  });

  await withPlayerApi(clerkUserId, async (baseUrl) => {
    const responses = await Promise.all([
      postJson(`${baseUrl}/player/onboarding`, { action: "claim-reward" }),
      postJson(`${baseUrl}/player/onboarding`, { action: "claim-reward" }),
    ]);
    assert.deepEqual(rewardCredits(responses[0]), rewardCredits(responses[1]));
    assert.equal(responses[0].profile.softCurrency, 250);
    assert.equal(responses[0].profile.packTickets, 1);
    const profile = await profileFor(clerkUserId);
    assert.equal(profile.softCurrency, 250);
    assert.equal(profile.packTickets, 1);
    assert.equal(profile.starterRewardClaimed, true);
  });
});

test("concurrent HTTP mission claims return the same single-applied profile", async (t) => {
  const clerkUserId = `route-mission-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
  });
  await db.insert(playerMissionsTable).values({
    clerkUserId,
    missionKey: "route-claim",
    cadence: "onboarding",
    title: "Route Claim",
    description: "Exercise mission claim through HTTP.",
    progress: 1,
    goal: 1,
    rewardCurrency: "packTickets",
    rewardAmount: 2,
  });

  await withPlayerApi(clerkUserId, async (baseUrl) => {
    const responses = await Promise.all([
      postJson(`${baseUrl}/player/missions/route-claim/claim`),
      postJson(`${baseUrl}/player/missions/route-claim/claim`),
    ]);
    assert.deepEqual(rewardCredits(responses[0]), rewardCredits(responses[1]));
    assert.equal(responses[0].profile.packTickets, 2);
    const profile = await profileFor(clerkUserId);
    assert.equal(profile.packTickets, 2);
    const [mission] = await db
      .select()
      .from(playerMissionsTable)
      .where(
        and(
          eq(playerMissionsTable.clerkUserId, clerkUserId),
          eq(playerMissionsTable.missionKey, "route-claim"),
        ),
      );
    assert.ok(mission?.claimedAt);
  });
});
