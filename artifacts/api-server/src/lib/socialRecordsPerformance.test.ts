import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import { NoopLogger } from "drizzle-orm/logger";
import {
  db,
  playerProfilesTable as profiles,
  socialIdentitiesTable as identities,
  socialRelationshipsTable as relations,
  socialBlocksTable as blocks,
  onlineRoomsTable as rooms,
} from "@workspace/db";
import { createApp } from "../app";
import { getSocialRecords, tallyFadeRecords, tallySocialFadeRecords } from "./socialRecords";
import { getSocialRecordsReference, tallyFadeRecordsReference } from "./socialRecordsReference.fixture";

type HistoryRow = Parameters<typeof tallyFadeRecords>[0][number];

function referenceTotals(rows: HistoryRow[], userId: string, playerIds: readonly string[]) {
  return {
    self: tallyFadeRecordsReference(rows, userId),
    players: new Map(playerIds.map(id => [id, {
      overall: tallyFadeRecordsReference(rows, id),
      personal: tallyFadeRecordsReference(rows, userId, id),
    }])),
  };
}

function states(): Record<string, unknown>[] {
  return [
    {}, { series: null }, { series: { player: 3, cpu: 1, draws: 2 } },
    { series: { player: 0, cpu: 0, draws: 0 } },
    { series: { player: -2, cpu: 4.5 } },
    { series: { player: "3", cpu: "2", draws: "1" } },
    { series: { player: [], cpu: {}, draws: null } },
    { series: "legacy", ranked: false }, { ranked: {} },
    { ranked: { settlement: null }, winner: "player" },
    { ranked: { settlement: {} }, winner: "cpu" },
    { ranked: { settlement: { player: {} } }, winner: "player" },
    { ranked: { settlement: { cpu: {} } }, winner: "cpu" },
    { ranked: { settlement: [1] }, winner: "draw" },
    { ranked: { settlement: "legacy" }, winner: "unknown" },
    { ranked: { settlement: { player: {} } }, winner: null },
  ];
}

test("one-pass social records preserve legacy values, seat precedence and ordered arithmetic", () => {
  const ids = ["self", "friend-a", "friend-b", "", "outside"];
  const variations = states();
  const rows: HistoryRow[] = [];
  for (const hostUserId of ids) for (const guestUserId of [...ids, null]) {
    for (const state of variations) rows.push({ hostUserId, guestUserId, state });
  }
  const snapshot = structuredClone(rows);
  for (const userId of ids) for (const playerIds of [
    [], ["friend-a"], ["friend-a", "friend-b"], ids, [...ids].reverse(), ["self", "self", ""],
  ]) {
    const expected = referenceTotals(rows, userId, playerIds);
    const actual = tallySocialFadeRecords(rows, userId, playerIds);
    assert.deepEqual(actual, expected);
    assert.equal(JSON.stringify([...actual.players]), JSON.stringify([...expected.players]));
    assert.deepEqual(tallyFadeRecords(rows, userId), expected.self);
    for (const opponent of ids) {
      assert.deepEqual(tallyFadeRecords(rows, userId, opponent), tallyFadeRecordsReference(rows, userId, opponent));
    }
  }
  assert.deepEqual(rows, snapshot, "history and persisted JSON are never modified");
});

test("request-local totals cannot leak or retain old records", () => {
  const history = [{ hostUserId: "self", guestUserId: "friend", state: { series: { player: 2, cpu: 1, draws: 0 } } }];
  const first = tallySocialFadeRecords(history, "self", ["friend"]);
  first.self.wins = 1000;
  first.players.get("friend")!.personal.wins = 2000;
  assert.deepEqual(tallySocialFadeRecords(history, "self", ["friend"]), referenceTotals(history, "self", ["friend"]));
  history[0]!.state.series.player = 3;
  assert.equal(tallySocialFadeRecords(history, "self", ["friend"]).self.wins, 3);
  assert.deepEqual(tallySocialFadeRecords([], "another", []).self, { wins: 0, losses: 0, draws: 0 });
});

test("unrelated invalid rows remain ignored and invalid relevant rows retain tally errors", () => {
  const invalid = { hostUserId: "outside", guestUserId: null, state: null } as unknown as HistoryRow;
  assert.deepEqual(tallySocialFadeRecords([invalid], "self", ["friend"]), referenceTotals([invalid], "self", ["friend"]));
  for (const userId of ["outside", "self"]) {
    const players = ["outside", "friend"];
    assert.throws(() => referenceTotals([invalid], userId, players), TypeError);
    assert.throws(() => tallySocialFadeRecords([invalid], userId, players), TypeError);
  }
});

test("social-record history membership work scales once with history, not once per player", t => {
  const playerIds = Array.from({ length: 100 }, (_, i) => `friend-${i}`);
  let reads = 0;
  const rows: HistoryRow[] = Array.from({ length: 5_000 }, (_, i) => {
    const host = i % 3 ? playerIds[i % playerIds.length]! : "self";
    const guest = i % 7 ? playerIds[(i + 1) % playerIds.length]! : null;
    return {
      get hostUserId() { reads++; return host; },
      get guestUserId() { reads++; return guest; },
      state: { series: { player: i % 4, cpu: i % 3, draws: i % 2 } },
    };
  });
  const expected = referenceTotals(rows, "self", playerIds);
  const before = reads;
  reads = 0;
  const actual = tallySocialFadeRecords(rows, "self", playerIds);
  const after = reads;
  assert.deepEqual(actual, expected);
  assert.equal(after, 2 * rows.length, "each row reads its two membership IDs once");
  assert(after < before / 100);
  for (const visibleIds of [[], playerIds.slice(0, 1), playerIds.slice(0, 2)]) {
    reads = 0;
    const smallExpected = referenceTotals(rows, "self", visibleIds);
    const smallBefore = reads;
    reads = 0;
    const smallActual = tallySocialFadeRecords(rows, "self", visibleIds);
    const smallAfter = reads;
    assert.deepEqual(smallActual, smallExpected);
    if (!visibleIds.length) assert.equal(smallAfter, smallBefore, "no-friends path retains its original single tally");
    else {
      assert.equal(smallAfter, 2 * rows.length);
      assert(smallAfter < smallBefore, "even one visible friend avoids repeated membership scans");
    }
  }
  t.diagnostic(`5,000 rooms / 100 players: membership field reads ${before} -> ${after}; exact totals, no history-copy arrays or cross-request cache.`);
});

test("social records retain exact SQL, visibility, errors, response order and fresh updates", async t => {
  const users = Array.from({ length: 8 }, () => `records-perf-${randomUUID()}`);
  const codes = Array.from({ length: 8 }, () => randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase());
  t.after(async () => { await db.delete(profiles).where(inArray(profiles.clerkUserId, users)); });
  await db.insert(profiles).values(users.map(clerkUserId => ({
    clerkUserId, softCurrency: 987, cosmeticCurrency: 12, inbox: [{ id: "do-not-change" }],
  })));
  await db.insert(identities).values(users.slice(0, 7).map((userId, i) => ({ userId, friendCode: codes[i]! })));
  for (const friend of [1, 2, 3, 4, 7]) {
    const [low, high] = [users[0]!, users[friend]!].sort();
    await db.insert(relations).values({ low: low!, high: high!, sender: users[0]!, status: "homie" });
  }
  await db.insert(blocks).values([
    { userId: users[0]!, targetId: users[3]! },
    { userId: users[4]!, targetId: users[0]! },
  ]);
  const variations = states();
  const roomCodes: string[] = [];
  for (let i = 0; i < variations.length; i++) {
    const code = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    roomCodes.push(code);
    await db.insert(rooms).values({
      code, hostUserId: users[i % users.length]!,
      guestUserId: i % 5 === 0 ? null : users[(i + 1) % users.length]!,
      createRequestId: randomUUID(), expiresAt: new Date(0), state: variations[i]!,
    });
  }
  const opponentCode = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  await db.insert(rooms).values({
    code: opponentCode, hostUserId: users[5]!, guestUserId: users[0]!,
    createRequestId: randomUUID(), expiresAt: new Date(0),
    state: { series: { player: 2, cpu: 3, draws: 1 }, privateMatch: { hands: ["secret-card"] } },
  });
  const profileBefore = await db.select().from(profiles).where(inArray(profiles.clerkUserId, users));
  const queries: { text: string; params: unknown[] }[] = [];
  t.mock.method(NoopLogger.prototype, "logQuery", (...args: unknown[]) => {
    queries.push({ text: String(args[0]), params: args[1] as unknown[] });
  });
  async function compare(userId: string, roomCode?: string) {
    queries.length = 0;
    const expected = await getSocialRecordsReference(userId, roomCode);
    const beforeQueries = [...queries];
    queries.length = 0;
    const actual = await getSocialRecords(userId, roomCode);
    assert.deepEqual(actual, expected);
    assert.equal(JSON.stringify(actual), JSON.stringify(expected));
    assert.deepEqual(queries, beforeQueries, "SQL text, parameters and query order are identical");
    assert(queries.every(query => /^select /i.test(query.text)), "read path performs no mutations or transactions");
    assert.equal(queries.length, (roomCode ? 4 : 3) + Number(actual.players.length > 0));
    return actual;
  }
  const initial = await compare(users[0]!);
  assert.equal(initial.players.length, 2, "both block directions and missing identities stay hidden");
  assert.equal(initial.opponentCode, null);
  const withOpponent = await compare(users[0]!, opponentCode.toLowerCase());
  assert.equal(withOpponent.opponentCode, codes[5]);
  assert.equal(withOpponent.players.find(player => player.friendCode === codes[5])?.homie, false);
  for (const id of users.slice(1)) await compare(id);
  for (const roomCode of [opponentCode, "MISSINGROOM"]) {
    queries.length = 0;
    await assert.rejects(getSocialRecordsReference(users[6]!, roomCode), { name: "Error", message: "Only room participants can view this record.", status: 403 });
    const expectedQueries = [...queries];
    queries.length = 0;
    await assert.rejects(getSocialRecords(users[6]!, roomCode), { name: "Error", message: "Only room participants can view this record.", status: 403 });
    assert.deepEqual(queries, expectedQueries);
    assert.equal(queries.length, 2, "authorization failure still precedes history and identity reads");
  }
  await db.update(rooms).set({
    state: { series: { player: 5, cpu: 8, draws: 2 } },
  }).where(eq(rooms.code, opponentCode));
  const fresh = await compare(users[0]!, opponentCode);
  assert.notDeepEqual(fresh, withOpponent, "next request immediately observes the updated room");
  await db.insert(blocks).values({ userId: users[5]!, targetId: users[0]! });
  const blocked = await compare(users[0]!, opponentCode);
  assert.equal(blocked.opponentCode, null);
  assert.equal(blocked.players.some(player => player.friendCode === codes[5]), false);
  assert(!JSON.stringify(blocked).includes("secret-card"));
  assert(users.every(id => !JSON.stringify(blocked).includes(id)), "response contains public friend codes, not account IDs");
  assert.deepEqual(await db.select().from(profiles).where(inArray(profiles.clerkUserId, users)), profileBefore);

  const server = createApp((req, _res, next) => {
    const userId = typeof req.headers["x-test-user"] === "string" ? req.headers["x-test-user"] : null;
    Object.assign(req, { auth: Object.assign(() => ({
      userId, sessionId: userId ? "test-session" : null, tokenType: "session_token",
      isAuthenticated: !!userId, sessionClaims: userId ? { sub: userId } : null,
    }), { [Symbol.for("@clerk/express.auth")]: true }) });
    next();
  }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/social/records`;
  queries.length = 0;
  const anonymous = await fetch(base);
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await anonymous.json(), { error: "Sign in to find your homies." });
  assert.equal(queries.length, 0);
  const denied = await fetch(`${base}?room=${opponentCode}`, { headers: { "x-test-user": users[6]! } });
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "Only room participants can view this record." });
  const allowed = await fetch(`${base}?room=${opponentCode}`, { headers: { "x-test-user": users[0]! } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await allowed.json(), blocked);
  t.diagnostic("Exact baseline SQL and JSON retained; next-request room/block freshness, 401/403 authorization, no-store and unchanged profile/economy data verified on owned disposable PGlite.");
});
