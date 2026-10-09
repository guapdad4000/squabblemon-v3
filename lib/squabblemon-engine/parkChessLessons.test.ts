import assert from "node:assert/strict";
import { test } from "node:test";
import { Chess } from "chess.js";
import {
  PARK_CHESS_LESSONS, ParkChessLessonError, advanceParkChessLesson, createParkChessLesson,
  getParkChessLessonView, playParkChessLessonMove, resetParkChessLesson,
  type ParkChessLessonState,
} from "./src/parkChessLessons";

test("three always-available tutorials teach all six piece roles", () => {
  assert.deepEqual(PARK_CHESS_LESSONS.map(lesson => lesson.id), ["move-capture", "protect-guap", "ashlee-mate"]);
  const roles = PARK_CHESS_LESSONS[0]!.steps.map(step => new Chess(step.startFen).get(step.expectedMove.from as never)?.type);
  assert.deepEqual([...new Set(roles)].sort(), ["b", "k", "n", "p", "q", "r"]);
  for (const lesson of PARK_CHESS_LESSONS) {
    const state = createParkChessLesson(lesson.id);
    assert.equal(state.status, "ready");
    assert.equal(state.phase, "active");
    assert.equal(state.stepIndex, 0);
    assert.equal(getParkChessLessonView(state).turn, "w");
  }
});

test("all scripted moves and replies are legal and keep the result visible until Next", () => {
  for (const lesson of PARK_CHESS_LESSONS) {
    let state = createParkChessLesson(lesson.id);
    for (let index = 0; index < lesson.steps.length; index++) {
      const step = lesson.steps[index]!;
      const original = structuredClone(state);
      const view = getParkChessLessonView(state);
      assert.equal(view.step.id, step.id);
      assert.ok(view.legalMoves.some(move => move.from === step.expectedMove.from && move.to === step.expectedMove.to));
      const chess = new Chess(step.startFen);
      const expected = chess.move(step.expectedMove);
      if (step.reply) {
        assert.equal(chess.isGameOver(), false, "no scripted reply can continue after a terminal position");
        chess.move(step.reply);
      }
      const next = playParkChessLessonMove(state, step.expectedMove);
      assert.equal(next.fen, chess.fen());
      assert.equal(next.lastPlayerMove?.san, expected.san);
      assert.equal(next.status, "success");
      assert.equal(next.stepIndex, index, "successful board remains visible for feedback");
      assert.equal(next.feedback, step.success);
      assert.equal(next.moves.length, step.reply ? 2 : 1);
      assert.equal(next.phase, index === lesson.steps.length - 1 ? "complete" : "active");
      assert.equal(getParkChessLessonView(next).legalMoves.length, 0);
      assert.deepEqual(state, original);
      state = advanceParkChessLesson(next);
      if (index < lesson.steps.length - 1) {
        assert.equal(state.stepIndex, index + 1);
        assert.equal(state.status, "ready");
        assert.equal(state.moves.length, 0);
        assert.equal(state.lastMove, null);
        assert.equal(state.feedback, null);
      }
    }
    assert.equal(state.phase, "complete");
  }
});

test("legal moves outside the guided goal do not advance or mutate a lesson", () => {
  for (const lesson of PARK_CHESS_LESSONS) {
    let state = createParkChessLesson(lesson.id);
    for (const step of lesson.steps) {
      const original = structuredClone(state);
      const alternative = getParkChessLessonView(state).legalMoves.find(move => move.from !== step.expectedMove.from || move.to !== step.expectedMove.to || move.promotion !== step.expectedMove.promotion);
      assert.ok(alternative, "each practice table allows a real legal alternative");
      assert.throws(() => playParkChessLessonMove(state, alternative), error => error instanceof ParkChessLessonError && error.code === "wrong-move" && error.message.includes(step.hint));
      assert.deepEqual(state, original);
      state = advanceParkChessLesson(playParkChessLessonMove(state, step.expectedMove));
    }
  }
});

test("illegal moves cannot advance the lesson and include a useful hint", () => {
  const state = createParkChessLesson("move-capture");
  const original = structuredClone(state);
  for (const input of [{ from: "e2", to: "e5" }, { from: "a0", to: "a1" }, { from: "h8", to: "g8" }]) {
    assert.throws(() => playParkChessLessonMove(state, input), error => error instanceof ParkChessLessonError && error.code === "invalid-move" && /Select the pawn/.test(error.message));
    assert.deepEqual(state, original);
  }
  assert.throws(() => advanceParkChessLesson(state), ParkChessLessonError);
});

test("replay resets any step or completed lesson and remains available indefinitely", () => {
  for (const lesson of PARK_CHESS_LESSONS) {
    let state = createParkChessLesson(lesson.id);
    const initial = structuredClone(state);
    for (const step of lesson.steps) {
      assert.deepEqual(resetParkChessLesson(state), initial);
      state = playParkChessLessonMove(state, step.expectedMove);
      assert.deepEqual(resetParkChessLesson(state), initial);
      state = advanceParkChessLesson(state);
    }
    assert.equal(state.phase, "complete");
    assert.throws(() => playParkChessLessonMove(state, lesson.steps[0]!.expectedMove), error => error instanceof ParkChessLessonError && error.code === "lesson-complete");
    assert.deepEqual(advanceParkChessLesson(state), state);
    for (let repeat = 0; repeat < 5; repeat++) assert.deepEqual(resetParkChessLesson(state), initial);
  }
});

test("successful steps cannot accept another move before explicit advancement", () => {
  const step = PARK_CHESS_LESSONS[0]!.steps[0]!;
  const state = playParkChessLessonMove(createParkChessLesson("move-capture"), step.expectedMove);
  assert.throws(() => playParkChessLessonMove(state, { from: "e4", to: "e5" }), error => error instanceof ParkChessLessonError && error.code === "step-complete");
});

test("Protect GUAP starts in actual check and exercises three different legal defenses", () => {
  const lesson = PARK_CHESS_LESSONS[1]!;
  let state = createParkChessLesson(lesson.id);
  for (let index = 0; index < 3; index++) {
    assert.equal(getParkChessLessonView(state).inCheck, true);
    state = playParkChessLessonMove(state, lesson.steps[index]!.expectedMove);
    assert.equal(getParkChessLessonView(state).inCheck, false);
    state = advanceParkChessLesson(state);
  }
  const castled = getParkChessLessonView(playParkChessLessonMove(state, lesson.steps[3]!.expectedMove));
  assert.equal(castled.lastPlayerMove?.san, "O-O");
  assert.equal(castled.lastBotMove?.san, "O-O-O");
  for (const [square, type, color] of [["g1", "k", "w"], ["f1", "r", "w"], ["c8", "k", "b"], ["d8", "r", "b"]])
    assert.ok(castled.board.some(piece => piece.square === square && piece.type === type && piece.color === color));
});

test("Ashlee's first table continues into the real back-rank mate, then teaches a second protected mate", () => {
  const lesson = PARK_CHESS_LESSONS[2]!;
  let state = playParkChessLessonMove(createParkChessLesson(lesson.id), lesson.steps[0]!.expectedMove);
  assert.equal(state.lastPlayerMove?.san, "Qd5+");
  assert.equal(state.lastBotMove?.san, "Kh8");
  const firstResult = state.fen;
  state = advanceParkChessLesson(state);
  assert.equal(state.fen, firstResult, "the forced retreat leads directly into the next mating move");
  state = playParkChessLessonMove(state, lesson.steps[1]!.expectedMove);
  assert.equal(getParkChessLessonView(state).checkmate, true);
  assert.equal(state.lastPlayerMove?.san, "Qd8#");
  assert.equal(state.phase, "active", "Next presents the second mate pattern");
  state = advanceParkChessLesson(state);
  state = playParkChessLessonMove(state, lesson.steps[2]!.expectedMove);
  assert.equal(getParkChessLessonView(state).checkmate, true);
  assert.equal(state.lastPlayerMove?.san, "Qg7#");
  assert.equal(state.phase, "complete");
  assert.equal(state.lastBotMove, null);
});

test("serialized progress restores its verified board and malformed progress can always reset", () => {
  const initial = createParkChessLesson("move-capture");
  const state = playParkChessLessonMove(initial, PARK_CHESS_LESSONS[0]!.steps[0]!.expectedMove);
  assert.deepEqual(getParkChessLessonView(JSON.parse(JSON.stringify(state))), getParkChessLessonView(state));
  for (const corrupt of [
    { ...state, fen: initial.fen }, { ...state, moves: ["e2e5"] }, { ...state, stepIndex: -1 },
    { ...state, status: "ready" }, { ...initial, phase: "complete" },
  ]) {
    assert.throws(() => getParkChessLessonView(corrupt as ParkChessLessonState), ParkChessLessonError);
    assert.deepEqual(resetParkChessLesson(corrupt as ParkChessLessonState), initial);
  }
  assert.throws(() => createParkChessLesson("other-lesson"), error => error instanceof ParkChessLessonError && error.code === "unknown-lesson");
});

test("lesson state and definitions contain no reward, ticket, campaign, API or tier authority", () => {
  for (const lesson of PARK_CHESS_LESSONS) {
    let state = createParkChessLesson(lesson.id);
    for (const step of lesson.steps) state = advanceParkChessLesson(playParkChessLessonMove(state, step.expectedMove));
    for (const key of ["earned", "packTickets", "campaign", "wins", "tier", "requestId", "actionId", "runId"]) assert.equal(key in state, false);
  }
});
