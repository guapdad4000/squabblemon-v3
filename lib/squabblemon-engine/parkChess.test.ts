import assert from "node:assert/strict";
import { test } from "node:test";
import { Chess } from "chess.js";
import {
  PARK_CHESS_TIERS, ParkChessRuleError, chooseParkChessBotMove, createParkChessRun,
  getNextParkChessTier, getParkChessTier, getParkChessView, playParkChessMove, resignParkChessRun,
  type ParkChessRun,
} from "./src/parkChess";

function position(fen: string, tier = 2): ParkChessRun {
  const normalized = new Chess(fen).fen();
  return { ...createParkChessRun("rules-fixture", tier), startFen: normalized, fen: normalized };
}

function history(moves: string[], tier = 2): ParkChessRun {
  const chess = new Chess();
  for (const move of moves) chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), ...(move[4] ? { promotion: move[4] } : {}) });
  return { ...createParkChessRun("history-fixture", tier), moves: [...moves], fen: chess.fen() };
}

test("standard start has 32 pieces and 20 legal moves with the human on white", () => {
  const view = getParkChessView(createParkChessRun("start", 1));
  assert.equal(view.board.length, 32);
  assert.equal(view.legalMoves.length, 20);
  assert.equal(view.turn, "w");
  assert.deepEqual(view.captured, { w: [], b: [] });
});

test("a player turn makes one legal bot reply, advances one revision, and preserves the original run", () => {
  const run = createParkChessRun("normal-game", 1);
  const original = structuredClone(run);
  const next = playParkChessMove(run, { from: "e2", to: "e4" });
  assert.equal(next.revision, 1);
  assert.equal(next.moves.length, 2);
  assert.equal(next.lastPlayerMove?.san, "e4");
  assert.ok(next.lastBotMove);
  assert.equal(getParkChessView(next).turn, "w");
  assert.deepEqual(run, original);
  assert.deepEqual(getParkChessView(JSON.parse(JSON.stringify(next))), getParkChessView(next));
});

test("illegal moves, wrong colors, malformed promotion and empty squares cannot alter the board", () => {
  const run = createParkChessRun("invalid-game", 1);
  for (const input of [
    { from: "e2", to: "e5" }, { from: "a3", to: "a4" }, { from: "a7", to: "a6" },
    { from: "e2", to: "e4", promotion: "k" }, { from: "z2", to: "e4" },
  ]) {
    assert.throws(() => playParkChessMove(run, input as never), error => error instanceof ParkChessRuleError && error.code === "invalid-move");
    assert.equal(run.moves.length, 0);
  }
});

test("a pinned piece cannot expose its own king; check replies are filtered", () => {
  const run = position("4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1");
  assert.throws(() => playParkChessMove(run, { from: "e2", to: "d2" }), ParkChessRuleError);
  const checked = getParkChessView(position("4r2k/8/8/8/8/8/8/R3K3 w - - 0 1"));
  assert.equal(checked.inCheck, true);
  assert.equal(checked.legalMoves.some(move => move.from === "a1" && move.to === "a2"), false);
});

test("castling moves both pieces and never crosses an attacked square", () => {
  const available = position("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", 1);
  assert.ok(getParkChessView(available).legalMoves.some(move => move.san === "O-O"));
  assert.ok(getParkChessView(available).legalMoves.some(move => move.san === "O-O-O"));
  const next = playParkChessMove(available, { from: "e1", to: "g1" });
  const board = getParkChessView(next).board;
  assert.ok(board.some(piece => piece.square === "g1" && piece.type === "k" && piece.color === "w"));
  assert.ok(board.some(piece => piece.square === "f1" && piece.type === "r" && piece.color === "w"));
  const attacked = position("r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1");
  assert.equal(getParkChessView(attacked).legalMoves.some(move => move.san === "O-O"), false);
  assert.throws(() => playParkChessMove(attacked, { from: "e1", to: "g1" }), ParkChessRuleError);
});

test("en passant removes the bypassed pawn and records its actual capture", () => {
  const run = position("7k/8/8/3pP3/8/8/8/K7 w - d6 0 1", 1);
  const next = playParkChessMove(run, { from: "e5", to: "d6" });
  const view = getParkChessView(next);
  assert.equal(view.board.some(piece => piece.square === "d5"), false);
  assert.ok(view.board.some(piece => piece.square === "d6" && piece.color === "w"));
  assert.deepEqual(view.captured.b, ["p"]);
  assert.equal(next.lastPlayerMove?.san, "exd6");
});

test("promotion explicitly offers all four pieces and does not invent a captured pawn", () => {
  const run = position("7k/P7/8/8/8/8/8/K7 w - - 0 1", 1);
  const promotions = getParkChessView(run).legalMoves.filter(move => move.from === "a7" && move.to === "a8");
  assert.deepEqual(promotions.map(move => move.promotion).sort(), ["b", "n", "q", "r"]);
  assert.throws(() => playParkChessMove(run, { from: "a7", to: "a8" }), ParkChessRuleError);
  for (const promotion of ["q", "r", "b", "n"] as const) {
    const promoted = getParkChessView(playParkChessMove(run, { from: "a7", to: "a8", promotion }));
    assert.ok(promoted.board.some(piece => piece.square === "a8" && piece.type === promotion));
    assert.deepEqual(promoted.captured.b, []);
    assert.deepEqual(promoted.captured.w, []);
  }
});

test("white checkmate is a win before the bot can reply, and no further move is accepted", () => {
  const won = playParkChessMove(position("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"), { from: "f7", to: "g7" });
  assert.equal(won.phase, "won");
  assert.equal(won.reason, "checkmate");
  assert.equal(won.lastPlayerMove?.san, "Qg7#");
  assert.equal(won.lastBotMove, null);
  assert.equal(won.moves.length, 1);
  assert.deepEqual(getParkChessView(won).legalMoves, []);
  assert.throws(() => playParkChessMove(won, { from: "g7", to: "g8" }), error => error instanceof ParkChessRuleError && error.code === "run-over");
});

test("the bot recognizes mate in one and records a loss instead of a ticket win", () => {
  const before = history(["f2f4", "e7e5"], 2);
  const lost = playParkChessMove(before, { from: "g2", to: "g4" });
  assert.equal(lost.phase, "lost");
  assert.equal(lost.reason, "checkmate");
  assert.equal(lost.lastBotMove?.san, "Qh4#");
  assert.equal(getParkChessView(lost).inCheck, true);
});

test("stalemate, fifty moves and insufficient material end as draws without a bot reply", () => {
  for (const [fen, from, to, reason] of [
    ["7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", "f7", "e6", "stalemate"],
    ["8/8/8/8/8/6k1/8/R3K3 w Q - 99 1", "a1", "a2", "fifty-move-rule"],
    ["7k/8/8/8/8/2b5/8/KN6 w - - 0 1", "b1", "c3", "insufficient-material"],
  ]) {
    const run = playParkChessMove(position(fen!), { from: from!, to: to! });
    assert.equal(run.phase, "draw");
    assert.equal(run.reason, reason);
    assert.equal(run.lastBotMove, null);
  }
});

test("threefold history is retained on reload and terminal repeated games cannot continue", () => {
  const repeated = history(["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]);
  const restored = JSON.parse(JSON.stringify(repeated)) as ParkChessRun;
  assert.deepEqual(getParkChessView(restored).legalMoves, []);
  assert.throws(() => playParkChessMove(restored, { from: "e2", to: "e4" }), error => error instanceof ParkChessRuleError && error.code === "run-over");
});

test("a repeated position created by the player's move resolves as a draw", () => {
  const run = history(["g1f3", "g8f6", "f3g5", "f6g8", "g5f3", "g8f6", "f3g5", "f6g8"]);
  const drawn = playParkChessMove(run, { from: "g5", to: "f3" });
  assert.equal(drawn.phase, "draw");
  assert.equal(drawn.reason, "threefold-repetition");
  assert.equal(drawn.lastBotMove, null);
});

test("tampered FEN, illegal saved moves and moves after a draw are refused", () => {
  const run = createParkChessRun("tampered", 1);
  assert.throws(() => getParkChessView({ ...run, fen: run.fen.replace(" w ", " b ") }), error => error instanceof ParkChessRuleError && error.code === "corrupt-run");
  assert.throws(() => getParkChessView({ ...run, moves: ["e2e5"] }), ParkChessRuleError);
  const afterDraw = history(["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]);
  assert.throws(() => getParkChessView({ ...afterDraw, moves: [...afterDraw.moves, "e2e4"] }), ParkChessRuleError);
});

test("resigning preserves the board, ends the run and cannot be repeated", () => {
  const run = createParkChessRun("resign", 1);
  const resigned = resignParkChessRun(run);
  assert.equal(resigned.phase, "resigned");
  assert.equal(resigned.reason, "resignation");
  assert.equal(resigned.fen, run.fen);
  assert.equal(resigned.revision, 1);
  assert.throws(() => resignParkChessRun(resigned), ParkChessRuleError);
});

test("tier progression increases search depth and effort and caps at the fifth tier", () => {
  assert.deepEqual(PARK_CHESS_TIERS.map(tier => tier.depth), [0, 1, 2, 3, 4]);
  for (let i = 1; i < PARK_CHESS_TIERS.length; i++) assert.ok(PARK_CHESS_TIERS[i]!.nodeBudget > PARK_CHESS_TIERS[i - 1]!.nodeBudget);
  assert.equal(getNextParkChessTier(1), 2);
  assert.equal(getNextParkChessTier(5), 5);
  assert.equal(getParkChessTier(999).id, 5);
});

test("all bot tiers return legal deterministic choices within their strict search budgets", () => {
  const blackToMove = history(["e2e4"]);
  for (const tier of PARK_CHESS_TIERS) {
    const run = { ...blackToMove, tier: tier.id };
    const original = structuredClone(run);
    const decision = chooseParkChessBotMove(run);
    const repeat = chooseParkChessBotMove(run);
    assert.deepEqual(decision, repeat);
    assert.ok(decision.move);
    const chess = new Chess(run.fen);
    assert.ok(chess.move(decision.move!));
    assert.ok(decision.nodes <= decision.nodeBudget);
    assert.ok(decision.depthCompleted <= tier.depth);
    if (tier.id > 1) assert.ok(decision.depthCompleted >= 1);
    assert.deepEqual(run, original);
  }
});

test("higher tiers look past a poisoned free pawn that the greedy tier takes", () => {
  const run = position("6k1/8/8/4q3/4P3/8/8/4R1K1 b - - 0 1", 2);
  const greedy = chooseParkChessBotMove(run);
  const tactical = chooseParkChessBotMove({ ...run, tier: 3 });
  assert.equal(greedy.move?.san, "Qxe4");
  assert.notEqual(tactical.move?.san, "Qxe4");
  assert.ok(tactical.depthCompleted >= 2);
});
