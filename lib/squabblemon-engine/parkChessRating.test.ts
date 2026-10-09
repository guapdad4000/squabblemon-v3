import assert from "node:assert/strict";
import test from "node:test";
import {
  createParkChessRating, expectedParkChessScore, getParkChessOpponentRating, settleParkChessRating,
  PARK_CHESS_RATING_MIN, PARK_CHESS_RATING_MAX, type ParkChessRatingState, type ParkChessRatingResult,
} from "./src/parkChessRating";

test("Park Rating starts independently of chess wins and uses ordered internal opponent anchors", () => {
  assert.deepEqual(createParkChessRating(), { value: 800, games: 0, peak: 800 });
  assert.deepEqual([1, 2, 3, 4, 5].map(getParkChessOpponentRating), [600, 800, 1000, 1200, 1400]);
  assert.notEqual(createParkChessRating(), createParkChessRating());
});

test("equal ratings give a 50 percent expected score, plus16 win, minus16 loss and zero draw", () => {
  assert.equal(expectedParkChessScore(800, 800), 0.5);
  for (const [result, delta] of [["win", 16], ["loss", -16], ["draw", 0]] as const) {
    const settled = settleParkChessRating(createParkChessRating(), 2, result);
    assert.equal(settled.change.delta, delta);
    assert.equal(settled.state.value, 800 + delta);
    assert.equal(settled.state.games, 1);
    assert.equal(settled.state.peak, Math.max(800, 800 + delta));
    assert.deepEqual(settled.change, { before: 800, after: 800 + delta, delta, opponent: 800, result });
  }
});

test("expected scores complement each other and stronger-opponent wins earn more", () => {
  const favored = expectedParkChessScore(1200, 800);
  assert.ok(Math.abs(favored - 10 / 11) < 1e-12);
  assert.ok(Math.abs(favored + expectedParkChessScore(800, 1200) - 1) < 1e-12);
  const state = createParkChessRating();
  const gains = [1, 2, 3, 4, 5].map(tier => settleParkChessRating(state, tier, "win").change.delta);
  assert.deepEqual(gains, [8, 16, 24, 29, 31]);
});

test("losses to weaker opponents cost more and draws reflect opponent strength", () => {
  const state = createParkChessRating();
  assert.equal(settleParkChessRating(state, 1, "loss").change.delta, -24);
  assert.equal(settleParkChessRating(state, 5, "loss").change.delta, -1);
  assert.ok(settleParkChessRating(state, 1, "draw").change.delta < 0);
  assert.ok(settleParkChessRating(state, 5, "draw").change.delta > 0);
});

test("repeated easy wins have diminishing gains and eventually round to zero", () => {
  let state = createParkChessRating();
  const first = settleParkChessRating(state, 1, "win");
  state = first.state;
  let last = first;
  for (let i = 0; i < 500; i++) { last = settleParkChessRating(state, 1, "win"); state = last.state; }
  assert.equal(last.change.delta, 0);
  assert.ok(state.value < 1400, "Rookie grinding does not yield unlimited rating");
  assert.equal(state.games, 501, "zero-delta rated results still count as games");
});

test("rating limits prevent underflow or overflow and peak survives losses", () => {
  const low = settleParkChessRating({ value: PARK_CHESS_RATING_MIN, games: 8, peak: 800 }, 5, "loss");
  assert.deepEqual(low.state, { value: PARK_CHESS_RATING_MIN, games: 9, peak: 800 });
  assert.equal(low.change.delta, 0);
  const high = settleParkChessRating({ value: PARK_CHESS_RATING_MAX, games: 10, peak: PARK_CHESS_RATING_MAX }, 1, "win");
  assert.equal(high.state.value, PARK_CHESS_RATING_MAX);
  assert.equal(high.change.delta, 0);
  const lost = settleParkChessRating({ value: 1000, games: 4, peak: 1100 }, 2, "loss");
  assert.equal(lost.state.peak, 1100);
});

test("settlement is deterministic and leaves the saved state untouched", () => {
  const input = Object.freeze({ value: 813, games: 3, peak: 850 });
  const first = settleParkChessRating(input, 3, "draw");
  assert.deepEqual(first, settleParkChessRating(input, 3, "draw"));
  assert.deepEqual(input, { value: 813, games: 3, peak: 850 });
  assert.notEqual(input, first.state);
});

test("a trusted opponent snapshot preserves start-time expectations when tier anchors change", () => {
  const settled = settleParkChessRating(createParkChessRating(), 5, "win", 800);
  assert.equal(settled.change.opponent, 800);
  assert.equal(settled.change.delta, 16);
  assert.throws(() => settleParkChessRating(createParkChessRating(), 5, "win", NaN), RangeError);
});

test("invalid tiers, malformed ratings and unsupported outcomes cannot produce NaN or corrupt progress", () => {
  for (const tier of [0, 6, 1.5, NaN, Infinity]) assert.throws(() => getParkChessOpponentRating(tier), RangeError);
  for (const value of [NaN, Infinity, 99, 3001, 800.5]) assert.throws(() => expectedParkChessScore(value, 800), RangeError);
  for (const patch of [{ value: NaN }, { games: -1 }, { games: 0.5 }, { games: Number.MAX_SAFE_INTEGER }, { peak: 799 }]) {
    assert.throws(() => settleParkChessRating({ ...createParkChessRating(), ...patch } as ParkChessRatingState, 1, "win"), RangeError);
  }
  assert.throws(() => settleParkChessRating(createParkChessRating(), 1, "abandoned" as ParkChessRatingResult), RangeError);
});
