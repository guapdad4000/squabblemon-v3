import assert from "node:assert/strict";
import test from "node:test";
import {
  checkpointFor,
  encounterFor,
  recordChallengeMatch,
  type ChallengeRun,
} from "@workspace/squabblemon-engine/challenge";

const run = (overrides: Partial<ChallengeRun> = {}): ChallengeRun => ({
  id: "run-1", playerId: "player-1", status: "active", seed: 17,
  entryDate: "2026-01-01", entryNumber: 1, encounterIndex: 0, wins: 0,
  crew: { deckId: "crew", cards: Array.from({ length: 10 }, (_, i) => ({
    cardId: `card-${i}`, xp: 0, level: 1, upgradeIds: [],
  })), capturedAt: "2026-01-01T00:00:00.000Z", rulesVersion: 1 },
  encounter: encounterFor(17, 0, "match-0"), transcripts: [], personalBest: false,
  ...overrides,
});

const transcript = (matchId: string, outcome: "win" | "draw" | "loss", moves: unknown[] = []) => ({
  matchId, outcome, moves, checkpoint: checkpointFor(matchId, moves),
});

test("challenge encounters use a stable cadence, bounded rival pool, and boss every fifth stop", () => {
  const encounters = Array.from({ length: 25 }, (_, index) => encounterFor(99, index));
  assert.deepEqual(encounters.filter(item => item.boss).map(item => item.index), [4, 9, 14, 19, 24]);
  assert.ok(encounters.every(item => ["block", "slide", "combo", "receipts", "crashout", "vibes", "compound"].includes(item.rivalDeckId)));
  assert.ok(encounters.every((item, index) => item.seed === encounterFor(99, index).seed));
  assert.equal(encounterFor(99, 4).rivalDeckId, "block");
});

test("challenge outcomes advance wins, retain draws, settle losses, and are idempotent", () => {
  const first = recordChallengeMatch(run(), transcript("match-0", "win", ["a"]), "match-1");
  assert.equal(first.wins, 1);
  assert.equal(first.encounterIndex, 1);
  assert.equal(first.encounter.playerMatchId, "match-1");
  const draw = recordChallengeMatch(run(), transcript("match-0", "draw", ["a"]),"unused");
  assert.equal(draw.status, "active");
  assert.equal(draw.encounterIndex, 0);
  const loss = recordChallengeMatch(run(), transcript("match-0", "loss"), "unused");
  assert.equal(loss.status, "settled");
  assert.equal(loss.wins, 0);
  assert.strictEqual(recordChallengeMatch(first, transcript("match-0", "win", ["a"]), "different"), first);
  assert.throws(() => recordChallengeMatch(first, transcript("match-0", "win", ["changed"]),"match-2"), /checkpoint/);
});

test("UTC day keys do not depend on local timezone", async () => {
  const { utcDay } = await import("@workspace/squabblemon-engine/challenge");
  assert.equal(utcDay("2026-01-02T00:15:00.000Z"), "2026-01-02");
  assert.equal(utcDay("2026-01-01T23:59:59.999Z"), "2026-01-01");
});