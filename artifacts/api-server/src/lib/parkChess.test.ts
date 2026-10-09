import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db, pool, playerCollectionClaimsTable as claims, playerProfilesTable as profiles } from "@workspace/db";
import { type ParkChessRun } from "@workspace/squabblemon-engine/parkChess";
import { parkChessStartInput, parkChessMoveInput, parkChessResignInput } from "@workspace/api-zod";
import { createApp } from "../app";
import { getParkChess, startParkChess, moveParkChess, resignParkChess, type ParkChessStatus } from "./parkChess";

after(() => pool.end());
const now = new Date("2026-10-08T20:00:00Z");
const mateFen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
const lossFen = "rnbqkbnr/pppp1ppp/8/4p3/5P2/8/PPPPP1PP/RNBQKBNR w KQkq - 0 2";
async function player(t: test.TestContext) {
  const id = `park-chess-${randomUUID()}`;
  await db.insert(profiles).values({ clerkUserId: id, onboardingStep: "complete", softCurrency: 321, packTickets: 7, styleShards: 17 });
  t.after(() => db.delete(profiles).where(eq(profiles.clerkUserId, id)));
  return id;
}
async function profile(userId: string) { return (await db.select().from(profiles).where(eq(profiles.clerkUserId, userId)))[0]!; }
/** Positions are inserted only in this owned test database, never accepted by the API. */
async function position(userId: string, run: ParkChessRun, fen: string) {
  const [row] = await db.select().from(claims).where(and(eq(claims.clerkUserId, userId), eq(claims.milestoneKey, `park-chess:run:v1:${run.id}`)));
  await db.update(claims).set({ reward: { parkChessRun: { ...row.reward.parkChessRun!, state: { ...run, startFen: fen, fen, moves: [] } } } }).where(eq(claims.id, row.id));
}
async function mate(userId: string, tier?: number) {
  const started = await startParkChess(userId, randomUUID(), now, tier);
  await position(userId, started.run!, mateFen);
  return moveParkChess(userId, started.run!.id, 0, randomUUID(), { from: "f7", to: "g7" }, now);
}

test("chess starts are durable and concurrent requests reuse one active game across reloads", async t => {
  const user = await player(t);
  assert.equal((await getParkChess(user, now)).run, null);
  const ids = Array.from({ length: 3 }, () => randomUUID());
  const starts = await Promise.all(ids.map(id => startParkChess(user, id, now)));
  assert.equal(new Set(starts.map(s => s.run!.id)).size, 1);
  assert.equal(starts[0].run!.board.length, 32);
  assert.equal(starts[0].run!.tier, 1);
  assert.equal(starts[0].run!.revision, 0);
  assert.deepEqual((await getParkChess(user, now)).run, starts[0].run);
  const actionId = randomUUID();
  const ended = await resignParkChess(user, starts[0].run!.id, 0, actionId, now);
  assert.equal(ended.run!.phase, "resigned");
  assert.equal(ended.campaign.games, 1);
  assert.equal(ended.campaign.losses, 1);
  for (const id of ids) {
    const retry = await startParkChess(user, id, now);
    assert.equal(retry.run!.id, ended.run!.id, "a concurrent start retry cannot create a new game after its reused game ended");
    assert.equal(retry.run!.phase, "resigned");
  }
  const retry = await resignParkChess(user, starts[0].run!.id, 0, actionId, now);
  assert.equal(retry.replayed, true);
  assert.equal(retry.campaign.games, 1);
  assert.equal((await profile(user)).packTickets, 7);
  assert.equal((await startParkChess(user, randomUUID(), now)).run!.phase, "active");
});

test("legal turns include server AI; durable action receipts reject changed retries, stale revisions and foreign games", async t => {
  const user = await player(t), other = await player(t);
  const started = await startParkChess(user, randomUUID(), now), run = started.run!, actionId = randomUUID();
  await assert.rejects(moveParkChess(user, run.id, 0, randomUUID(), { from: "e2", to: "e5" }, now), /legal|Invalid move/i);
  assert.equal((await getParkChess(user, now)).run!.revision, 0);
  const moved = await Promise.all([0, 1, 2].map(() => moveParkChess(user, run.id, 0, actionId, { from: "e2", to: "e4" }, now)));
  assert.equal(moved[0].run!.revision, 1);
  assert.equal(moved[0].run!.moves.length, 2);
  assert.equal(moved[0].run!.lastPlayerMove!.from, "e2");
  assert.ok(moved[0].run!.lastBotMove);
  assert.equal(moved[0].run!.turn, "w");
  assert.deepEqual(moved.map(m => m.run), [moved[0].run, moved[0].run, moved[0].run]);
  await assert.rejects(moveParkChess(user, run.id, 0, actionId, { from: "e2", to: "e3" }, now), /action ID/);
  await assert.rejects(moveParkChess(user, run.id, 0, randomUUID(), { from: "e2", to: "e4" }, now), /changed/);
  await assert.rejects(moveParkChess(other, run.id, 1, randomUUID(), { from: "e2", to: "e4" }, now), /not found/);
  await assert.rejects(resignParkChess(other, run.id, 1, randomUUID(), now), /not found/);
  const nextMove = moved[0].run!.legalMoves[0];
  const next = await moveParkChess(user, run.id, 1, randomUUID(), { from: nextMove.from, to: nextMove.to, ...(nextMove.promotion ? { promotion: nextMove.promotion } : {}) }, now);
  const oldRetry = await moveParkChess(user, run.id, 0, actionId, { from: "e2", to: "e4" }, now);
  assert.equal(oldRetry.run!.revision, next.run!.revision, "an old retry resumes the latest saved position");
  assert.equal(oldRetry.replayed, true);
  assert.equal((await profile(user)).packTickets, 7);
});

test("each actual checkmate pays exactly one ticket, advances difficulty through five tiers and has no daily cap", async t => {
  const user = await player(t), before = await profile(user);
  for (let index = 0; index < 7; index++) {
    const started = await startParkChess(user, randomUUID(), now);
    assert.equal(started.run!.tier, Math.min(5, index + 1));
    await position(user, started.run!, mateFen);
    const actionId = randomUUID();
    const results = await Promise.all([0, 1, 2].map(() => moveParkChess(user, started.run!.id, 0, actionId, { from: "f7", to: "g7" }, now)));
    for (const result of results) {
      assert.equal(result.run!.phase, "won");
      assert.equal(result.run!.reason, "checkmate");
      assert.equal(result.run!.lastPlayerMove!.san, "Qg7#");
      assert.equal(result.run!.lastBotMove, null);
      assert.equal(result.earned.packTickets, 1);
      assert.equal(result.campaign.wins, index + 1);
      assert.equal(result.campaign.games, index + 1);
      assert.equal(result.campaign.tier, Math.min(5, index + 2));
    }
    await assert.rejects(moveParkChess(user, started.run!.id, 1, randomUUID(), { from: "g7", to: "g8" }, now), /changed|over/i);
    assert.equal((await profile(user)).packTickets, 8 + index);
    assert.equal((await getParkChess(user, now)).campaign.wins, index + 1);
  }
  const saved = await profile(user);
  assert.equal(saved.packTickets, before.packTickets + 7);
  assert.equal(saved.softCurrency, before.softCurrency);
  assert.equal(saved.styleShards, before.styleShards);
  assert.deepEqual(saved.ownedCardIds, before.ownedCardIds);
  assert.deepEqual(saved.discoveredCardIds, before.discoveredCardIds);
  assert.deepEqual(saved.settings, before.settings);
});

test("stalemate, fifty-move draw, resignation and actual bot checkmate grant no tickets or tier increase", async t => {
  const user = await player(t);
  const stalemate = await startParkChess(user, randomUUID(), now);
  await position(user, stalemate.run!, mateFen);
  const drawn = await moveParkChess(user, stalemate.run!.id, 0, randomUUID(), { from: "f7", to: "e6" }, now);
  assert.equal(drawn.run!.phase, "draw");
  assert.equal(drawn.run!.reason, "stalemate");
  assert.equal(drawn.earned.packTickets, 0);
  const fifty = await startParkChess(user, randomUUID(), now);
  await position(user, fifty.run!, "8/8/8/8/8/6k1/8/R3K3 w Q - 99 1");
  const fiftyDraw = await moveParkChess(user, fifty.run!.id, 0, randomUUID(), { from: "a1", to: "a2" }, now);
  assert.equal(fiftyDraw.run!.reason, "fifty-move-rule");
  assert.equal(fiftyDraw.earned.packTickets, 0);
  const resigned = await startParkChess(user, randomUUID(), now);
  await resignParkChess(user, resigned.run!.id, 0, randomUUID(), now);
  assert.equal((await getParkChess(user, now)).campaign.tier, 1);
  assert.equal((await profile(user)).packTickets, 7);
  await mate(user);
  const losing = await startParkChess(user, randomUUID(), now);
  assert.equal(losing.run!.tier, 2);
  await position(user, losing.run!, lossFen);
  const lost = await moveParkChess(user, losing.run!.id, 0, randomUUID(), { from: "g2", to: "g4" }, now);
  assert.equal(lost.run!.phase, "lost");
  assert.equal(lost.run!.lastBotMove!.san, "Qh4#");
  assert.equal(lost.earned.packTickets, 0);
  assert.equal(lost.runRating!.change!.result, "loss");
  assert.equal(lost.rating.games, 5);
  assert.deepEqual(lost.campaign, { wins: 1, losses: 2, draws: 2, games: 5, tier: 2 });
  assert.equal((await profile(user)).packTickets, 8);
});

test("unlocked tiers replay at their original difficulty and Rookie wins cannot unlock harder tiers", async t => {
  const user = await player(t);
  await mate(user);
  await mate(user);
  assert.equal((await getParkChess(user, now)).campaign.tier, 3);
  for (let index = 0; index < 3; index++) {
    const requestId = randomUUID();
    const started = await startParkChess(user, requestId, now, 1);
    assert.equal(started.run!.tier, 1);
    assert.equal(started.campaign.tier, 3);
    await position(user, started.run!, mateFen);
    const won = await moveParkChess(user, requestId, 0, randomUUID(), { from: "f7", to: "g7" }, now);
    assert.equal(won.campaign.tier, 3);
    assert.equal(won.campaign.wins, 3 + index);
    assert.equal(won.earned.packTickets, 1);
  }
  const frontier = await mate(user, 3);
  assert.equal(frontier.campaign.tier, 4);
  assert.equal(frontier.campaign.wins, 6);
  assert.equal((await profile(user)).packTickets, 13);
  const resumed = await startParkChess(user, randomUUID(), now);
  assert.equal(resumed.run!.tier, 4, "omitting the tier selects the unlocked frontier, not total wins + 1");
});

test("start selections reject invalid and locked tiers before saving a run or entry receipt", async t => {
  const user = await player(t);
  for (const tier of [0, 6, 1.5, Number.NaN])
    await assert.rejects(startParkChess(user, randomUUID(), now, tier), error => error instanceof Error && "status" in error && error.status === 400);
  const lockedId = randomUUID();
  await assert.rejects(startParkChess(user, lockedId, now, 2), /unlock/i);
  assert.equal((await getParkChess(user, now)).run, null);
  await mate(user);
  const unlocked = await startParkChess(user, lockedId, now, 2);
  assert.equal(unlocked.run!.tier, 2, "a rejected locked request did not consume its request ID");
  assert.equal(unlocked.run!.phase, "active");
  assert.equal((await profile(user)).packTickets, 8);
});

test("concurrent tier selections preserve the active match and durable entry receipts reject changed retries", async t => {
  const user = await player(t);
  await mate(user);
  const frontier = await startParkChess(user, randomUUID(), now, 2);
  const replayIds = Array.from({ length: 3 }, () => randomUUID());
  const starts = await Promise.all(replayIds.map(id => startParkChess(user, id, now, 1)));
  for (const started of starts) {
    assert.equal(started.run!.id, frontier.run!.id);
    assert.equal(started.run!.tier, 2, "a selected replay cannot replace an unfinished match");
    assert.equal(started.replayed, true);
  }
  for (const requestId of replayIds) {
    const [receipt] = await db.select().from(claims).where(and(eq(claims.clerkUserId, user), eq(claims.milestoneKey, `park-chess:start:v1:${requestId}`)));
    assert.equal(receipt.reward.parkChessStart!.tier, 2, "the receipt snapshots the actual resumed game difficulty");
    assert.equal(receipt.reward.parkChessStart!.requestedTier, 1);
  }
  await resignParkChess(user, frontier.run!.id, 0, randomUUID(), now);
  for (const requestId of replayIds) {
    assert.equal((await startParkChess(user, requestId, now, 1)).run!.phase, "resigned");
    await assert.rejects(startParkChess(user, requestId, now, 2), /entry ID/i);
    await assert.rejects(startParkChess(user, requestId, now), /entry ID/i);
  }
  const replay = await startParkChess(user, randomUUID(), now, 1);
  assert.equal(replay.run!.tier, 1);
  assert.equal(replay.campaign.games, 2);
  assert.equal(replay.campaign.tier, 2);
});

test("legacy campaigns preserve their unlocked frontier and legacy retries cannot silently create or switch a game", async t => {
  const user = await player(t), requestId = randomUUID();
  await db.insert(claims).values({ clerkUserId: user, milestoneKey: "park-chess:campaign:v1", reward: { parkChessCampaign: { version: 1, state: {
    wins: 2, losses: 1, draws: 0, games: 3, activeRunId: null, lastRunId: null,
  } } } });
  assert.equal((await getParkChess(user, now)).campaign.tier, 3);
  const replay = await startParkChess(user, requestId, now, 1);
  await position(user, replay.run!, mateFen);
  const won = await moveParkChess(user, requestId, 0, randomUUID(), { from: "f7", to: "g7" }, now);
  assert.equal(won.campaign.wins, 3);
  assert.equal(won.campaign.tier, 3);
  assert.equal((await getParkChess(user, now)).campaign.tier, 3, "the migrated frontier is stored independently of accumulated wins");
  const [receipt] = await db.select().from(claims).where(and(eq(claims.clerkUserId, user), eq(claims.milestoneKey, `park-chess:start:v1:${requestId}`)));
  await db.update(claims).set({ reward: { parkChessStart: { runId: requestId } } }).where(eq(claims.id, receipt.id));
  const oldRetry = await startParkChess(user, requestId, now);
  assert.equal(oldRetry.run!.id, requestId);
  assert.equal(oldRetry.run!.phase, "won");
  assert.equal(oldRetry.replayed, true);
  await assert.rejects(startParkChess(user, requestId, now, 1), /entry ID/i);
  assert.equal((await profile(user)).packTickets, 8);
  assert.equal((await startParkChess(user, randomUUID(), now)).run!.tier, 3);
});

test("a concurrent replay start and checkmate settle once and never advance the frontier twice", async t => {
  const user = await player(t), started = await startParkChess(user, randomUUID(), now), actionId = randomUUID();
  await position(user, started.run!, mateFen);
  const responses = await Promise.all([
    moveParkChess(user, started.run!.id, 0, actionId, { from: "f7", to: "g7" }, now),
    startParkChess(user, randomUUID(), now, 1),
    moveParkChess(user, started.run!.id, 0, actionId, { from: "f7", to: "g7" }, now),
    startParkChess(user, randomUUID(), now, 1),
  ]);
  const saved = await getParkChess(user, now);
  assert.equal(saved.campaign.games, 1);
  assert.equal(saved.campaign.wins, 1);
  assert.equal(saved.campaign.tier, 2);
  assert.equal((await profile(user)).packTickets, 8);
  assert.ok(responses.every(response => response.run!.id === started.run!.id || response.run!.tier === 1));
  assert.deepEqual(saved.rating, { value: 808, games: 1, peak: 808 });
  if (saved.run!.phase === "active") {
    assert.equal(saved.run!.tier, 1);
    assert.equal((await startParkChess(user, randomUUID(), now, 2)).run!.id, saved.run!.id);
  }
});

test("Park Rating persists separately, changes once for a result, and does not change during legal or rejected turns", async t => {
  const user = await player(t), empty = await getParkChess(user, now);
  assert.deepEqual(empty.rating, { value: 800, games: 0, peak: 800 });
  assert.equal(empty.runRating, null);
  const started = await startParkChess(user, randomUUID(), now, 1), run = started.run!;
  assert.deepEqual(started.runRating, { opponent: 600, change: null, rated: true });
  await assert.rejects(moveParkChess(user, run.id, 0, randomUUID(), { from: "e2", to: "e5" }, now), /legal|Invalid move/i);
  const moved = await moveParkChess(user, run.id, 0, randomUUID(), { from: "e2", to: "e4" }, now);
  assert.deepEqual(moved.rating, empty.rating);
  assert.equal(moved.runRating!.change, null);
  const actionId = randomUUID();
  const ended = await Promise.all([0, 1, 2].map(() => resignParkChess(user, run.id, 1, actionId, now)));
  for (const result of ended) {
    assert.deepEqual(result.rating, { value: 776, games: 1, peak: 800 });
    assert.deepEqual(result.runRating, { opponent: 600, rated: true, change: {
      before: 800, after: 776, delta: -24, opponent: 600, result: "loss",
    } });
    assert.equal(result.campaign.games, 1);
    assert.equal(result.campaign.tier, 1);
  }
  const reload = await getParkChess(user, now);
  assert.deepEqual(reload.rating, ended[0].rating);
  assert.deepEqual(reload.runRating, ended[0].runRating);
  assert.equal((await profile(user)).packTickets, 7);
  const next = await startParkChess(user, randomUUID(), now);
  assert.deepEqual(next.rating, reload.rating);
  assert.deepEqual(next.runRating, { opponent: 600, change: null, rated: true });
});

test("rated checkmates and draws save their rating receipt with ticket settlement and replay rewards remain unlimited", async t => {
  const user = await player(t), first = await mate(user, 1);
  assert.deepEqual(first.rating, { value: 808, games: 1, peak: 808 });
  assert.deepEqual(first.runRating!.change, { before: 800, after: 808, delta: 8, opponent: 600, result: "win" });
  assert.equal(first.earned.packTickets, 1);
  const requestId = randomUUID(), started = await startParkChess(user, requestId, now, 2);
  assert.deepEqual(started.runRating, { opponent: 800, change: null, rated: true });
  await position(user, started.run!, mateFen);
  const actionId = randomUUID();
  const drawn = await moveParkChess(user, requestId, 0, actionId, { from: "f7", to: "e6" }, now);
  assert.equal(drawn.run!.reason, "stalemate");
  assert.deepEqual(drawn.rating, { value: 808, games: 2, peak: 808 });
  assert.deepEqual(drawn.runRating!.change, { before: 808, after: 808, delta: 0, opponent: 800, result: "draw" });
  assert.equal(drawn.campaign.tier, 2);
  assert.equal(drawn.earned.packTickets, 0);
  const repeated = await moveParkChess(user, requestId, 0, actionId, { from: "f7", to: "e6" }, now);
  assert.equal(repeated.replayed, true);
  assert.deepEqual(repeated.rating, drawn.rating);
  assert.equal((await profile(user)).packTickets, 8);
  const replay = await mate(user, 1);
  assert.deepEqual(replay.rating, { value: 815, games: 3, peak: 815 });
  assert.equal(replay.campaign.tier, 2, "Park Rating is independent of the unlocked tier frontier");
  assert.equal((await profile(user)).packTickets, 9);
});

test("pre-rating active games finish unrated and historical wins do not fabricate a Park Rating", async t => {
  const user = await player(t), started = await startParkChess(user, randomUUID(), now);
  const [runRow] = await db.select().from(claims).where(and(eq(claims.clerkUserId, user), eq(claims.milestoneKey, `park-chess:run:v1:${started.run!.id}`)));
  const { ratingBefore: _rating, opponentRating: _opponent, ratingChange: _change, ...legacyRun } = runRow.reward.parkChessRun!;
  await db.update(claims).set({ reward: { parkChessRun: legacyRun } }).where(eq(claims.id, runRow.id));
  const [campaignRow] = await db.select().from(claims).where(and(eq(claims.clerkUserId, user), eq(claims.milestoneKey, "park-chess:campaign:v1")));
  await db.update(claims).set({ reward: { parkChessCampaign: { version: 1, state: {
    wins: 12, losses: 3, draws: 2, games: 17, activeRunId: started.run!.id, lastRunId: started.run!.id,
  } } } }).where(eq(claims.id, campaignRow.id));
  const restored = await getParkChess(user, now);
  assert.deepEqual(restored.rating, { value: 800, games: 0, peak: 800 });
  assert.equal(restored.campaign.tier, 5);
  assert.deepEqual(restored.runRating, { opponent: 600, change: null, rated: false });
  await position(user, restored.run!, mateFen);
  const won = await moveParkChess(user, started.run!.id, 0, randomUUID(), { from: "f7", to: "g7" }, now);
  assert.deepEqual(won.rating, restored.rating);
  assert.equal(won.runRating!.change, null);
  assert.equal(won.runRating!.rated, false);
  assert.equal(won.earned.packTickets, 1);
  assert.equal(won.campaign.wins, 13);
  assert.equal((await profile(user)).packTickets, 8);
  const rated = await startParkChess(user, randomUUID(), now, 5);
  assert.equal(rated.runRating!.rated, true);
  assert.equal(rated.runRating!.opponent, 1400);
  assert.deepEqual(rated.rating, { value: 800, games: 0, peak: 800 });
});

test("a mismatched rating snapshot cannot pay or overwrite a newer saved rating", async t => {
  const user = await player(t), started = await startParkChess(user, randomUUID(), now);
  await position(user, started.run!, mateFen);
  const [campaignRow] = await db.select().from(claims).where(and(eq(claims.clerkUserId, user), eq(claims.milestoneKey, "park-chess:campaign:v1")));
  const newerRating = { value: 900, games: 1, peak: 900 };
  await db.update(claims).set({ reward: { parkChessCampaign: { version: 1, state: {
    ...(campaignRow.reward.parkChessCampaign!.state as Record<string, unknown>), rating: newerRating,
  } } } }).where(eq(claims.id, campaignRow.id));
  await assert.rejects(moveParkChess(user, started.run!.id, 0, randomUUID(), { from: "f7", to: "g7" }, now), /saved rating changed/i);
  const saved = await getParkChess(user, now);
  assert.deepEqual(saved.rating, newerRating);
  assert.equal(saved.run!.phase, "active");
  assert.equal(saved.run!.revision, 0);
  assert.equal(saved.campaign.games, 0);
  assert.equal(saved.runRating!.change, null);
  assert.equal((await profile(user)).packTickets, 7);
});

test("the stored opponent rating determines settlement even when the current tier anchor differs", async t => {
  const user = await player(t), started = await startParkChess(user, randomUUID(), now);
  await position(user, started.run!, mateFen);
  const [runRow] = await db.select().from(claims).where(and(eq(claims.clerkUserId, user), eq(claims.milestoneKey, `park-chess:run:v1:${started.run!.id}`)));
  // A server-authored historical anchor remains part of this game. A later
  // bot tuning cannot change the expected score of an already-started match.
  await db.update(claims).set({ reward: { parkChessRun: { ...runRow.reward.parkChessRun!, opponentRating: 1000 } } }).where(eq(claims.id, runRow.id));
  assert.equal((await getParkChess(user, now)).runRating!.opponent, 1000);
  const won = await moveParkChess(user, started.run!.id, 0, randomUUID(), { from: "f7", to: "g7" }, now);
  assert.deepEqual(won.rating, { value: 824, games: 1, peak: 824 });
  assert.deepEqual(won.runRating!.change, { before: 800, after: 824, delta: 24, opponent: 1000, result: "win" });
  assert.equal((await profile(user)).packTickets, 8);
});

const auth = (userId: string | null): RequestHandler => (req, _res, next) => {
  const value = Object.assign(() => ({ userId, isAuthenticated: !!userId, tokenType: "session_token", sessionId: "test", sessionClaims: userId ? { sub: userId } : null }), { [Symbol.for("@clerk/express.auth")]: true });
  Object.assign(req, { auth: value }); next();
};
async function api(t: test.TestContext, userId: string | null) {
  const server = createApp(auth(userId)).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/player/park-chess`;
  return { get: () => fetch(base), post: (path: string, body: unknown) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) };
}
test("authenticated chess routes validate tier selections, reject forged results and history, and restore saved legal turns", async t => {
  const user = await player(t), other = await player(t);
  const anonymous = await api(t, null), own = await api(t, user), foreign = await api(t, other);
  assert.equal((await anonymous.get()).status, 401);
  assert.equal((await anonymous.post("/start", { requestId: randomUUID() })).status, 401);
  assert.equal((await own.post("/start", { requestId: randomUUID(), tier: 5, fen: mateFen })).status, 400);
  assert.equal((await own.post("/start", { requestId: randomUUID(), tier: 5 })).status, 409);
  assert.equal((await own.post("/start", { requestId: randomUUID(), tier: 0 })).status, 400);
  assert.equal((await own.post("/start", { requestId: randomUUID(), tier: "1" })).status, 400);
  assert.equal((await own.post("/start", { requestId: randomUUID(), tier: 1, rating: 3000 })).status, 400);
  assert.equal((await own.post("/start", { requestId: "not-a-uuid" })).status, 400);
  const start = await own.post("/start", { requestId: randomUUID(), tier: 1 });
  assert.equal(start.status, 200);
  const state = await start.json() as ParkChessStatus;
  assert.equal((await own.post(`/${state.run!.id}/move`, { revision: 0, actionId: randomUUID(), move: { from: "e2", to: "e4" }, phase: "won", packTickets: 999 })).status, 400);
  assert.equal((await own.post(`/${state.run!.id}/move`, { revision: 0, actionId: randomUUID(), move: { from: "e2", to: "e4" }, runRating: { change: { delta: 999 } } })).status, 400);
  assert.equal((await own.post(`/${state.run!.id}/move`, { revision: 0, actionId: randomUUID(), move: { from: "e2", to: "e4", fen: mateFen } })).status, 400);
  assert.equal((await foreign.post(`/${state.run!.id}/move`, { revision: 0, actionId: randomUUID(), move: { from: "e2", to: "e4" } })).status, 404);
  assert.equal((await own.post(`/${state.run!.id}/move`, { revision: 0, actionId: randomUUID(), move: { from: "e2", to: "e5" } })).status, 409);
  const moved = await own.post(`/${state.run!.id}/move`, { revision: 0, actionId: randomUUID(), move: { from: "e2", to: "e4" } });
  assert.equal(moved.status, 200);
  const saved = await moved.json() as ParkChessStatus;
  assert.equal(saved.run!.revision, 1);
  assert.equal(saved.run!.moves.length, 2);
  assert.deepEqual((await (await own.get()).json() as ParkChessStatus).run, saved.run);
  assert.equal((await own.post(`/${state.run!.id}/resign`, { revision: 1, actionId: randomUUID(), rewards: { packTickets: 1 } })).status, 400);
  const resigned = await own.post(`/${state.run!.id}/resign`, { revision: 1, actionId: randomUUID() });
  assert.equal(resigned.status, 200);
  assert.equal((await resigned.json() as ParkChessStatus).run!.phase, "resigned");
  assert.equal((await profile(user)).packTickets, 7);
});

test("chess input contracts accept only complete client intents", () => {
  assert.equal(parkChessStartInput.safeParse({ requestId: randomUUID(), wins: 10 }).success, false);
  for (const tier of [1, 2, 3, 4, 5]) assert.equal(parkChessStartInput.safeParse({ requestId: randomUUID(), tier }).success, true);
  for (const tier of [0, 6, 1.5, "1", null]) assert.equal(parkChessStartInput.safeParse({ requestId: randomUUID(), tier }).success, false);
  assert.equal(parkChessMoveInput.safeParse({ revision: 0, actionId: randomUUID(), move: { from: "a7", to: "a8", promotion: "q" } }).success, true);
  for (const move of [{ from: "a0", to: "a1" }, { from: "A7", to: "a8" }, { from: "a7", to: "a8", promotion: "k" }])
    assert.equal(parkChessMoveInput.safeParse({ revision: 0, actionId: randomUUID(), move }).success, false);
  assert.equal(parkChessResignInput.safeParse({ revision: -1, actionId: randomUUID() }).success, false);
});
