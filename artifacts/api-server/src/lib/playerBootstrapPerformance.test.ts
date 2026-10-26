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

test("settled HTTP bootstrap bounds database work and returns the latest wallet", async t => {
  const userId = `bootstrap-query-budget-${randomUUID()}`;
  cleanup(t, userId);
  await ensurePlayer(userId);
  await withPlayerApi(userId, async origin => {
    // Settle any published mail before measuring the repeat startup path.
    await request(origin, "/player/bootstrap");
    const queries = captureQueries(t);
    const state = await request(origin, "/player/bootstrap");
    const startupQueries = [...queries];
    const transactions = startupQueries.filter(query => /^begin$/i.test(query.text)).length;
    const locks = startupQueries.filter(query => /for update/i.test(query.text)).length;
    const writes = startupQueries.filter(query => /^(insert|update|delete) /i.test(query.text)).length;
    assert.ok(startupQueries.length <= 8, `settled startup must stay within 8 SQL statements; received ${startupQueries.length}`);
    assert.equal(transactions, 0, "a settled player opens no initialization transaction");
    assert.equal(locks, 0, "a settled player takes no profile row lock");
    assert.equal(writes, 0, "a settled player issues no provisioning insert or profile update");
    assert.equal(startupQueries.filter(query => query.text.includes("jsonb_array_elements")).length, 1,
      "the lock-free check still verifies receipt ownership");
    assert.doesNotMatch(selectsFrom(startupQueries, "player_profiles").map(query => query.text).join("\n"), /"pack_history"/,
      "bootstrap does not transfer the unused legacy pack_history column");
    t.diagnostic(JSON.stringify({ workload: "settled-bootstrap", statements: startupQueries.length, transactions, locks, writes }));
    await db.update(playerProfilesTable).set({ softCurrency: state.profile.softCurrency + 731 })
      .where(eq(playerProfilesTable.clerkUserId, userId));
    const next = await request(origin, "/player/bootstrap");
    assert.equal(next.profile.softCurrency, state.profile.softCurrency + 731, "bootstrap must not serve a cached wallet");
  });
});

test("lock-free bootstrap falls back to the locked repair for each kind of drift", async t => {
  const userId = `bootstrap-drift-${randomUUID()}`;
  cleanup(t, userId);
  await ensurePlayer(userId);
  // A realistic settled profile: owned cards, card progression and a saved deck
  // round-tripped through jsonb (which reorders object keys).
  const recipe = starterRecipes[0]!;
  await db.update(playerProfilesTable).set({
    onboardingStep: "complete", starterDeckId: recipe.id, ownedCardIds: recipe.catalogCardIds,
    savedDecks: [{ deckSize: 10, id: "mine", name: "Mine", cardIds: recipe.catalogCardIds.slice(0, 10), heroCardId: recipe.hero, recipeId: null }],
  }).where(eq(playerProfilesTable.clerkUserId, userId));
  await ensurePlayer(userId);
  const settledQueries = captureQueries(t);
  await getPlayerBootstrap(userId);
  assert.equal(settledQueries.filter(query => /for update/i.test(query.text)).length, 0, "settled baseline is lock-free");
  t.mock.restoreAll();

  const repairs: Array<[string, () => Promise<unknown>, (state: Awaited<ReturnType<typeof getPlayerBootstrap>>) => void]> = [
    ["new receipt card", () => recordCardReceipt(userId, "closet-nerd"),
      state => assert.ok(state.profile.ownedCardIds.includes("closet-nerd"))],
    ["legacy engine id", () => db.update(playerProfilesTable).set({ ownedCardIds: sql`owned_card_ids || '["barber"]'::jsonb` })
      .where(eq(playerProfilesTable.clerkUserId, userId)),
    state => { assert.ok(!state.profile.ownedCardIds.includes("barber")); assert.ok(state.profile.ownedCardIds.length > 0); }],
    ["stale collection progress", () => db.update(playerProfilesTable).set({ collectionProgress: 999 })
      .where(eq(playerProfilesTable.clerkUserId, userId)),
    state => assert.equal(state.profile.collectionProgress, state.profile.ownedCardIds.length)],
    ["unowned equipped variant", () => db.update(playerProfilesTable).set({ equippedVariants: { "not-owned": "nope" } })
      .where(eq(playerProfilesTable.clerkUserId, userId)),
    state => assert.deepEqual(state.profile.equippedVariants, {})],
    ["expired mission cadence", () => db.update(playerMissionsTable).set({ progress: 1, resetAt: new Date(Date.now() - 1_000) })
      .where(and(eq(playerMissionsTable.clerkUserId, userId), eq(playerMissionsTable.missionKey, "daily-show-up"))),
    state => {
      const mission = state.missions.find(item => item.id === "daily-show-up")!;
      assert.equal(mission.progress, 0);
      assert.ok(Date.parse(mission.resetAt!) > Date.now());
    }],
    ["missing mission row", () => db.delete(playerMissionsTable)
      .where(and(eq(playerMissionsTable.clerkUserId, userId), eq(playerMissionsTable.missionKey, "daily-show-up"))),
    state => assert.ok(state.missions.some(item => item.id === "daily-show-up"))],
    ["stale lastActiveAt", () => db.update(playerProfilesTable).set({ lastActiveAt: new Date(Date.now() - 10 * 60_000) })
      .where(eq(playerProfilesTable.clerkUserId, userId)),
    state => assert.ok(Date.now() - Date.parse(state.profile.lastActiveAt) < 60_000)],
  ];
  for (const [name, drift, verify] of repairs) {
    await drift();
    const queries = captureQueries(t);
    const state = await getPlayerBootstrap(userId);
    assert.equal(queries.filter(query => /for update/i.test(query.text)).length, 1, `${name}: repair runs under the profile lock`);
    verify(state);
    t.mock.restoreAll();
    const repeat = captureQueries(t);
    await getPlayerBootstrap(userId);
    assert.equal(repeat.filter(query => /for update/i.test(query.text)).length, 0, `${name}: repaired player is settled again`);
    t.mock.restoreAll();
  }
});

test("collection pack request keeps one fresh response and idempotent payment", async t => {
  const userId = `pack-route-work-${randomUUID()}`;
  cleanup(t, userId);
  await db.insert(playerProfilesTable).values({ clerkUserId: userId, packTickets: 2, onboardingStep: "complete" });
  await recordCardReceipt(userId, "closet-nerd");
  await withPlayerApi(userId, async origin => {
    const input = { paymentMethod: "ticket", idempotencyKey: randomUUID() };
    const queries = captureQueries(t);
    const opened = await request(origin, "/player/packs/open", "POST", input);
    const historyReads = selectsFrom(queries, "player_pack_openings").filter(query => query.text.includes("limit")).length;
    assert.equal(historyReads, 1, "only serialize pack history for the response");
    t.diagnostic(JSON.stringify({ workload: "pack-open", statements: queries.length, historyReads }));
    assert.ok(opened.bootstrap.profile.ownedCardIds.includes("closet-nerd"), "preflight still recovers earned ownership");
    assert.equal(opened.bootstrap.profile.packTickets, 1);
    const retry = await request(origin, "/player/packs/open", "POST", input);
    assert.equal(retry.alreadyOpened, true);
    assert.equal(retry.opening.id, opened.opening.id);
    assert.equal(retry.bootstrap.profile.packTickets, 1);
    assert.deepEqual(retry.opening.rewards, opened.opening.rewards);
  });
});

test("shop preflight recovers ownership before training and returns the updated wallet", async t => {
  const userId = `shop-route-work-${randomUUID()}`;
  cleanup(t, userId);
  await db.insert(playerProfilesTable).values({ clerkUserId: userId, softCurrency: 500, onboardingStep: "complete" });
  await recordCardReceipt(userId, "closet-nerd");
  await withPlayerApi(userId, async origin => {
    const input = { itemId: "training", cardId: "closet-nerd", idempotencyKey: randomUUID() };
    const queries = captureQueries(t);
    const trained = await request(origin, "/player/shop/purchases", "POST", input);
    const historyReads = selectsFrom(queries, "player_pack_openings").filter(query => query.text.includes("limit")).length;
    assert.equal(historyReads, 1, "training preflight must not assemble unused bootstrap data");
    t.diagnostic(JSON.stringify({ workload: "shop-training", statements: queries.length, historyReads }));
    assert.equal(trained.bootstrap.profile.cardProgression["closet-nerd"].xp, 100);
    assert.equal(trained.bootstrap.profile.softCurrency, 500 - trained.receipt.cost);
    const retry = await request(origin, "/player/shop/purchases", "POST", input);
    assert.equal(retry.alreadyPurchased, true);
    assert.equal(retry.bootstrap.profile.softCurrency, trained.bootstrap.profile.softCurrency);
    assert.equal(retry.bootstrap.profile.cardProgression["closet-nerd"].xp, 100);
  });
});

test("welcome and legend status initialize new accounts without building discarded bootstraps", async t => {
  for (const path of ["/player/packs/welcome", "/player/rewards/legend-bounties"]) {
    const userId = `status-route-work-${randomUUID()}`;
    cleanup(t, userId);
    await withPlayerApi(userId, async origin => {
      const queries = captureQueries(t);
      const state = await request(origin, path);
      const historyReads = selectsFrom(queries, "player_pack_openings").filter(query => query.text.includes('"rewards"') && query.text.includes("limit")).length;
      assert.equal(historyReads, 0, "status routes must not select unused pack reward history");
      t.diagnostic(JSON.stringify({ workload: path, statements: queries.length, historyReads }));
      if (path.endsWith("welcome")) assert.equal(state.available, true);
      const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
      assert.ok(profile, "status preflight provisions new profiles");
    });
  }
});

test("promo preflight preserves once-only rewards and a fresh response", async t => {
  const userId = `promo-route-work-${randomUUID()}`;
  cleanup(t, userId);
  await db.insert(playerProfilesTable).values({ clerkUserId: userId, onboardingStep: "complete" });
  await withPlayerApi(userId, async origin => {
    const queries = captureQueries(t);
    const redeemed = await request(origin, "/player/promo-codes/redeem", "POST", { code: "SIMMYFOODZ" });
    const historyReads = selectsFrom(queries, "player_pack_openings").filter(query => query.text.includes("limit")).length;
    assert.equal(historyReads, 1, "promo preflight keeps recovery but omits the discarded projection");
    t.diagnostic(JSON.stringify({ workload: "promo-redeem", statements: queries.length, historyReads }));
    assert.ok(redeemed.bootstrap.profile.ownedCardIds.includes("simmy"));
    assert.ok(redeemed.bootstrap.profile.ownedCardIds.includes("foodz"));
    const retry = await request(origin, "/player/promo-codes/redeem", "POST", { code: "SIMMYFOODZ" });
    assert.deepEqual(retry.bootstrap.profile.ownedCardIds, redeemed.bootstrap.profile.ownedCardIds);
    assert.equal(retry.bootstrap.profile.softCurrency, redeemed.bootstrap.profile.softCurrency);
  });
});

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
