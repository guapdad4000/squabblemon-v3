import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { NoopLogger } from "drizzle-orm/logger";
import type { RequestHandler } from "express";
import {
  db,
  pool,
  patchDraftsTable,
  playerCollectionClaimsTable,
  playerMatchesTable,
  playerMissionsTable,
  playerPackOpeningsTable,
  playerProfilesTable,
} from "@workspace/db";
import { accountRewardStatus, growthTasksForDate } from "@workspace/squabblemon-engine/accountRewards";
import { ROOKIE_CORE_IDS, starterRecipes } from "@workspace/squabblemon-engine/data";
import { createApp } from "../app";
import { getAccountRewards } from "./accountRewards";
import { COLLECTION_ROAD } from "./collectionEconomy";
import { openStreetPackForPlayer } from "./collectionTransactions";
import { getPlayerBootstrap, ensurePlayer } from "./playerState";

type Query = { text: string; params: unknown[] };

/** Observe the actual emitted SQL, including transactions; do not replace queries. */
function captureQueries(t: test.TestContext): Query[] {
  const queries: Query[] = [];
  t.mock.method(NoopLogger.prototype, "logQuery", (...args: unknown[]) => {
    queries.push({ text: String(args[0]), params: args[1] as unknown[] });
  });
  return queries;
}

function selectsFrom(queries: Query[], table: string) {
  return queries.filter(query => /^select /i.test(query.text) && query.text.includes(`from "${table}"`));
}

function cleanup(t: test.TestContext, clerkUserId: string) {
  t.after(async () => {
    await db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  });
}

function testAuth(clerkUserId: string): RequestHandler {
  return (req, _res, next) => {
    const auth = Object.assign(
      () => ({ userId: clerkUserId, sessionId: "performance-test", tokenType: "session_token", isAuthenticated: true }),
      { [Symbol.for("@clerk/express.auth")]: true },
    );
    Object.assign(req, { auth });
    next();
  };
}

async function withPlayerApi<T>(clerkUserId: string, run: (origin: string) => Promise<T>): Promise<T> {
  const server = createApp(testAuth(clerkUserId)).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    return await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

async function request(origin: string, path: string, method = "GET", body?: unknown, status = 200) {
  const response = await fetch(origin + path, {
    method,
    ...(body === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  const json = await response.json() as Record<string, any>;
  assert.equal(response.status, status, JSON.stringify(json));
  return json;
}

async function recordCardReceipt(clerkUserId: string, cardId: string) {
  await db.insert(playerPackOpeningsTable).values({
    clerkUserId,
    idempotencyKey: randomUUID(),
    oddsVersion: "street-pack-v5",
    paymentMethod: "ticket",
    cost: 1,
    pityBefore: 0,
    pityAfter: 1,
    rewards: [{ kind: "card", cardId, variantId: null, name: cardId, rarity: "Rare", isNew: true, amount: 1 }],
  });
}

test("HTTP bootstrap initializes once, recovers receipts and cadence, and includes late patch mail", async t => {
  const userId = `bootstrap-work-${randomUUID()}`;
  cleanup(t, userId);
  await db.insert(playerProfilesTable).values({ clerkUserId: userId, softCurrency: 123, packTickets: 4 });
  await recordCardReceipt(userId, "closet-nerd");
  await db.insert(playerMissionsTable).values({
    clerkUserId: userId, missionKey: "daily-show-up", cadence: "daily", title: "Old title",
    description: "", progress: 9, goal: 1, rewardCurrency: "softCurrency", rewardAmount: 100,
    claimedAt: new Date(Date.now() - 60_000), resetAt: new Date(Date.now() - 1_000),
  });
  const [patch] = await db.insert(patchDraftsTable).values({
    version: `performance-${randomUUID()}`, title: "Performance fixture", patchDate: "2026-10-01",
    overview: "A test letter.", status: "published", createdBy: "performance-test",
    publishedAt: new Date(), softCurrency: 0, packTickets: 0,
  }).returning({ id: patchDraftsTable.id });
  t.after(async () => { await db.delete(patchDraftsTable).where(eq(patchDraftsTable.id, patch.id)); });

  await withPlayerApi(userId, async origin => {
    const queries = captureQueries(t);
    const state = await request(origin, "/player/bootstrap");
    assert.ok(state.profile.ownedCardIds.includes("closet-nerd"), "immutable pack receipts still repair ownership");
    assert.equal(state.profile.softCurrency, 123);
    assert.equal(state.profile.packTickets, 4, "reading a gift letter must not claim it");
    assert.ok(state.profile.inbox.some((mail: { title: string }) => mail.title.includes("Performance fixture")));
    const mission = state.missions.find((item: { id: string }) => item.id === "daily-show-up");
    assert.equal(mission.progress, 0);
    assert.equal(mission.status, "active");
    assert.ok(Date.parse(mission.resetAt) > Date.now());
    assert.equal(queries.filter(query => query.text.startsWith('insert into "player_profiles"')).length, 1);
    assert.equal(queries.filter(query => query.text.includes("jsonb_array_elements")).length, 1);
    assert.equal(selectsFrom(queries, "player_pack_openings").filter(query => query.text.includes("limit")).length, 1);
    t.diagnostic("GET bootstrap: one provisioning insert and one immutable receipt recovery pass (previously two each).");
  });
});

test("HTTP bootstrap still provisions a brand-new account", async t => {
  const userId = `bootstrap-new-${randomUUID()}`;
  cleanup(t, userId);
  await withPlayerApi(userId, async origin => {
    const queries = captureQueries(t);
    const state = await request(origin, "/player/bootstrap");
    assert.equal(state.profile.id, userId);
    assert.equal(state.profile.onboardingStep, "profile");
    assert.deepEqual(state.profile.ownedCardIds, []);
    assert.ok(state.missions.length > 0);
    assert.equal(queries.filter(query => query.text.includes("jsonb_array_elements")).length, 1);
  });
});

test("bootstrap road read selects exact milestone IDs from a mixed receipt ledger", async t => {
  const userId = `bootstrap-road-${randomUUID()}`;
  cleanup(t, userId);
  await ensurePlayer(userId);
  const first = COLLECTION_ROAD[0]!;
  await db.insert(playerCollectionClaimsTable).values([
    { clerkUserId: userId, milestoneKey: first.id, reward: first.reward },
    ...Array.from({ length: 500 }, (_, index) => ({
      clerkUserId: userId,
      milestoneKey: `${["account:login", "stockz:bet", "notification", "park-chess:action"][index % 4]}:${index}`,
      reward: {},
    })),
    { clerkUserId: userId, milestoneKey: `${COLLECTION_ROAD[1]!.id}:unrelated`, reward: {} },
  ]);
  const queries = captureQueries(t);
  const state = await getPlayerBootstrap(userId);
  assert.equal(state.collectionRoad.find(milestone => milestone.id === first.id)?.status, "claimed");
  assert.ok(state.collectionRoad.filter(milestone => milestone.id !== first.id).every(milestone => milestone.status === "locked"));
  const [query] = selectsFrom(queries, "player_collection_claims");
  assert.ok(query);
  assert.match(query.text, /"milestone_key" in \(/);
  assert.deepEqual(query.params, [userId, ...COLLECTION_ROAD.map(milestone => milestone.id)]);
  const selected = await pool.query(query.text, query.params);
  assert.equal(selected.rowCount, 1, "the database returns only the matching road receipt");
  const allReceipts = await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, userId));
  assert.equal(allReceipts.length, 502, "read optimization must not delete or change the immutable ledger");
  t.diagnostic(`Road status predicate binds ${COLLECTION_ROAD.length} exact milestone IDs; the 502-row fixture has only one matching row.`);
});

test("profile PATCH recovers an owned avatar first but serializes bootstrap only for its response", async t => {
  const userId = `profile-read-work-${randomUUID()}`;
  cleanup(t, userId);
  await db.insert(playerProfilesTable).values({ clerkUserId: userId });
  await recordCardReceipt(userId, "closet-nerd");
  await withPlayerApi(userId, async origin => {
    const queries = captureQueries(t);
    const state = await request(origin, "/player/profile", "PATCH", { avatarKey: "closet-nerd", reducedMotion: true });
    assert.equal(state.profile.avatarKey, "closet-nerd");
    assert.equal(state.profile.settings.reducedMotion, true);
    assert.ok(state.profile.ownedCardIds.includes("closet-nerd"));
    assert.equal(selectsFrom(queries, "player_pack_openings").filter(query => query.text.includes("limit")).length, 1);
    assert.equal(selectsFrom(queries, "player_collection_claims").length, 1);
    assert.equal(queries.filter(query => query.text.includes("jsonb_array_elements")).length, 2,
      "preserve normalization both before mutation and in the response");
    t.diagnostic("Profile PATCH: one pack-history and one road-status query (previously two each); initialization safeguards remain.");
  });
});

test("mission claim and concurrent bootstrap preserve one reward, cadence, and pack grants", async t => {
  const userId = `mission-bootstrap-work-${randomUUID()}`;
  cleanup(t, userId);
  await ensurePlayer(userId);
  await db.update(playerProfilesTable).set({ packTickets: 1 }).where(eq(playerProfilesTable.clerkUserId, userId));
  await db.update(playerMissionsTable).set({ progress: sql`${playerMissionsTable.goal}`, resetAt: new Date(Date.now() + 86_400_000) }).where(and(
    eq(playerMissionsTable.clerkUserId, userId), eq(playerMissionsTable.missionKey, "daily-show-up"),
  ));
  const [mission] = await db.select().from(playerMissionsTable).where(and(
    eq(playerMissionsTable.clerkUserId, userId), eq(playerMissionsTable.missionKey, "daily-show-up"),
  ));
  await withPlayerApi(userId, async origin => {
    const queries = captureQueries(t);
    const claimed = await request(origin, "/player/missions/daily-show-up/claim", "POST", {});
    assert.equal(claimed.profile.softCurrency, mission.rewardAmount);
    assert.equal(selectsFrom(queries, "player_pack_openings").filter(query => query.text.includes("limit")).length, 1);
    assert.equal(selectsFrom(queries, "player_collection_claims").length, 1);
    const [, , , pack] = await Promise.all([
      request(origin, "/player/missions/daily-show-up/claim", "POST", {}),
      request(origin, "/player/missions/daily-show-up/claim", "POST", {}),
      request(origin, "/player/bootstrap"),
      openStreetPackForPlayer(userId, { paymentMethod: "ticket", idempotencyKey: randomUUID() }),
    ]);
    const state = await request(origin, "/player/bootstrap");
    const expectedCurrency = mission.rewardAmount + pack.opening.rewards
      .filter(reward => reward.kind === "softCurrency")
      .reduce((sum, reward) => sum + reward.amount, 0);
    assert.equal(state.profile.softCurrency, expectedCurrency);
    assert.equal(state.profile.packTickets, 0);
    for (const reward of pack.opening.rewards) {
      if (reward.kind === "card") assert.ok(state.profile.ownedCardIds.includes(reward.cardId));
    }
    assert.equal(state.missions.find((item: { id: string }) => item.id === "daily-show-up").status, "claimed");
    // Once its cadence expires, a claimed mission cannot be reopened and paid again.
    await db.update(playerMissionsTable).set({ resetAt: new Date(Date.now() - 1_000) }).where(and(
      eq(playerMissionsTable.clerkUserId, userId), eq(playerMissionsTable.missionKey, "daily-show-up"),
    ));
    await request(origin, "/player/missions/daily-show-up/claim", "POST", {}, 400);
    const reset = await request(origin, "/player/bootstrap");
    assert.equal(reset.profile.softCurrency, expectedCurrency);
    assert.equal(reset.missions.find((item: { id: string }) => item.id === "daily-show-up").progress, 0);
  });
});

test("account status projects only level, creation date and daily growth without changing rewards", async t => {
  const userId = `account-projection-${randomUUID()}`;
  cleanup(t, userId);
  await ensurePlayer(userId);
  const now = new Date("2026-10-20T12:00:00Z");
  const daily = { date: "2026-10-20", counters: Object.fromEntries(growthTasksForDate(now).map(task => [task.key, 1])) };
  await db.update(playerProfilesTable).set({
    level: 20, createdAt: new Date("2026-01-01Z"),
    storyProgress: { unrelatedHistory: "not needed by account status".repeat(1000), growthDaily: daily },
  }).where(eq(playerProfilesTable.clerkUserId, userId));
  for (const growthDaily of [daily, undefined]) {
    if (growthDaily === undefined) {
      await db.update(playerProfilesTable).set({ storyProgress: {} }).where(eq(playerProfilesTable.clerkUserId, userId));
    }
    const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    const missions = await db.select().from(playerMissionsTable).where(eq(playerMissionsTable.clerkUserId, userId));
    const queries = captureQueries(t);
    const status = await getAccountRewards(userId, now);
    assert.deepEqual(status, accountRewardStatus(profile.level, profile.createdAt, [], now, missions, growthDaily));
    const [query] = selectsFrom(queries, "player_profiles");
    assert.ok(query);
    assert.match(query.text, /^select "level", "created_at", /);
    assert.match(query.text, /"story_progress"->'growthDaily' from/);
    assert.doesNotMatch(query.text, /owned_card_ids|inbox|saved_decks|card_progression/);
  }
});

test("practice history projection preserves rival repeat avoidance and previous activity roster", async t => {
  const userId = `practice-projection-${randomUUID()}`;
  cleanup(t, userId);
  await ensurePlayer(userId);
  const recipe = starterRecipes[0]!;
  await db.update(playerProfilesTable).set({
    onboardingStep: "complete", ownedCardIds: recipe.catalogCardIds,
  }).where(eq(playerProfilesTable.clerkUserId, userId));
  const previousCardIds = [...ROOKIE_CORE_IDS];
  await db.insert(playerMatchesTable).values({
    clerkUserId: userId, mode: "practice", playerDeckId: recipe.id, rivalDeckId: "slide",
    playerEngineCardIds: previousCardIds, completedAt: new Date(), outcome: "loss",
  });
  await withPlayerApi(userId, async origin => {
    const queries = captureQueries(t);
    const match = await request(origin, "/player/matches", "POST", {
      mode: "practice", playerDeckId: recipe.id, rivalDeckId: "block",
    }, 201);
    assert.notEqual(match.rivalDeckId, "slide");
    assert.deepEqual(match.encounterSnapshot.activity.previousCardIds, previousCardIds);
    const [query] = selectsFrom(queries, "player_matches").filter(query => query.text.includes('order by "player_matches"."completed_at" desc'));
    assert.ok(query);
    assert.match(query.text, /^select "rival_deck_id", "player_engine_card_ids" from/);
    assert.doesNotMatch(query.text, /story_encounter_snapshot|transcript|card_progression_snapshot/);
  });
});
