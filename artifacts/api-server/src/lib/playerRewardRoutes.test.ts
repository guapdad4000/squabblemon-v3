import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import {
  db,
  playerMatchesTable,
  playerMissionsTable,
  playerProfilesTable,
} from "@workspace/db";
import { createApp } from "../app";

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

test("concurrent HTTP fade completions return one persisted reward and apply it once", async (t) => {
  const clerkUserId = `route-match-${randomUUID()}`;
  cleanup(t, clerkUserId);
  await db.insert(playerProfilesTable).values({
    clerkUserId,
    onboardingStep: "complete",
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