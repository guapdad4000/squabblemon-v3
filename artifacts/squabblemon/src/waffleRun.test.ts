import test from "node:test";
import assert from "node:assert/strict";
import {
  createWaffleRun,
  applyWaffleAction,
  waffleRewards,
  waffleHopTargets,
  waffleWatchedPlate,
  WAFFLE_MOVES,
  type WaffleRun,
} from "@workspace/squabblemon-engine/waffleRun";
import {
  JOHN_HENRY_CHAPTERS,
  johnHenryMythicStatus,
} from "@workspace/squabblemon-engine/johnHenryMythic";
const start = () => createWaffleRun("run", "2026-10-06", 0, 0);
function caught() {
  return applyWaffleAction(start(), { type: "hop", plate: 1 }, 1400);
}
function battle() {
  const run = caught();
  return applyWaffleAction(
    run,
    { type: "learn", move: run.offeredMoves[0] },
    1500,
  );
}
test("John Henry requires every real Season 1 chapter clear; reaching the last chapter alone is not enough", () => {
  const chapters = JOHN_HENRY_CHAPTERS.map((id) => ({ id, status: "cleared" }));
  assert.equal(johnHenryMythicStatus(chapters, false, false).state, "ready");
  chapters[7].status = "available";
  assert.equal(johnHenryMythicStatus(chapters, false, false).state, "locked");
  assert.equal(
    johnHenryMythicStatus(
      [{ id: "the-crown", status: "cleared" }],
      false,
      false,
    ).state,
    "locked",
  );
  assert.equal(johnHenryMythicStatus([], true, true).state, "claimed");
});
test("plate hops use legal neighboring plates and the authoritative watch clock; input is immutable", () => {
  const run = start(),
    saved = structuredClone(run);
  assert.deepEqual(waffleHopTargets(run), [1, 2]);
  assert.equal(waffleWatchedPlate(run, 1400), 1);
  assert.throws(
    () => applyWaffleAction(run, { type: "hop", plate: 4 }, 1400),
    /nearby/,
  );
  assert.throws(
    () => applyWaffleAction(run, { type: "hop", plate: 1 }, 50),
    /land/,
  );
  const next = applyWaffleAction(run, { type: "hop", plate: 1 }, 1400);
  assert.equal(next.phase, "learning");
  assert.equal(next.waffles, 1);
  assert.equal(next.offeredMoves.length, 3);
  assert.equal(new Set(next.offeredMoves).size, 3);
  assert.deepEqual(run, saved);
});
test("each caught encounter requires a move pick before fighting; unsupported moves and exhausted PP cannot advance", () => {
  const run = caught();
  assert.throws(
    () => applyWaffleAction(run, { type: "move", move: "peck" }, 1500),
    /not available/,
  );
  assert.throws(
    () => applyWaffleAction(run, { type: "learn", move: "peck" }, 1500),
    /offered/,
  );
  const next = applyWaffleAction(
    run,
    { type: "learn", move: run.offeredMoves[0] },
    1500,
  );
  assert.equal(next.phase, "battle");
  assert.equal(next.moves.length, 2);
  assert.equal(next.pp[next.moves[1]], WAFFLE_MOVES[next.moves[1]].pp);
  next.pp[next.moves[1]] = 0;
  assert.throws(
    () => applyWaffleAction(next, { type: "move", move: next.moves[1] }, 1600),
    /not available/,
  );
});
test("move replacement keeps the basic attack, four distinct moves, and refills uses per encounter", () => {
  const run = caught();
  run.moves = ["peck", "wing-slap", "crumb-guard", "dine-dash"];
  run.offeredMoves = ["syrup-spit"];
  assert.throws(
    () =>
      applyWaffleAction(
        run,
        { type: "learn", move: "syrup-spit", replace: 0 },
        1500,
      ),
    /Peck/,
  );
  const next = applyWaffleAction(
    run,
    { type: "learn", move: "syrup-spit", replace: 2 },
    1500,
  );
  assert.deepEqual(next.moves, [
    "peck",
    "wing-slap",
    "syrup-spit",
    "dine-dash",
  ]);
  assert.equal(next.pp["syrup-spit"], 3);
});
test("guard, healing, dodging and telegraphed heavy hits have distinct combat effects", () => {
  const run = battle();
  run.moves = ["peck", "crumb-guard", "waffle-heal", "dine-dash"];
  run.pp = { peck: 99, "crumb-guard": 4, "waffle-heal": 2, "dine-dash": 3 };
  run.hp = 20;
  run.enemyHp = 100;
  let next = applyWaffleAction(
    run,
    { type: "move", move: "crumb-guard" },
    1600,
  );
  assert.equal(next.hp, 23);
  next = applyWaffleAction(
    { ...run, enemyIntent: "strike", enemyCharge: true },
    { type: "move", move: "dine-dash" },
    1600,
  );
  assert.equal(next.hp, 20);
  assert.equal(next.enemyCharge, false);
  next = applyWaffleAction(run, { type: "move", move: "waffle-heal" }, 1600);
  assert.equal(next.hp, 30);
  next = applyWaffleAction(
    { ...run, enemyIntent: "wind-up" },
    { type: "move", move: "peck" },
    1600,
  );
  assert.equal(next.hp, 20);
  assert.equal(next.enemyCharge, true);
  assert.equal(next.enemyIntent, "strike");
});
test("battle wins preserve health, add recovery, and return to hopping; death ends the run and keeps rewards", () => {
  const run = battle();
  run.enemyHp = 1;
  run.hp = 12;
  const won = applyWaffleAction(run, { type: "move", move: "peck" }, 1600);
  assert.equal(won.phase, "hopping");
  assert.equal(won.wins, 1);
  assert.equal(won.hp, 16);
  run.hp = 1;
  run.enemyHp = 100;
  const lost = applyWaffleAction(run, { type: "move", move: "peck" }, 1600);
  assert.equal(lost.phase, "ended");
  assert.equal(lost.hp, 0);
  assert.equal(lost.endReason, "caught");
  assert.equal(lost.waffles, 1);
  assert.throws(
    () => applyWaffleAction(lost, { type: "hop", plate: 2 }, 2000),
    /finished/,
  );
});
test("replaying identical state, input and time is deterministic; progressive earnings are monotonic and capped", () => {
  const run = battle(),
    snapshot = structuredClone(run);
  assert.deepEqual(
    applyWaffleAction(run, { type: "move", move: "peck" }, 1700),
    applyWaffleAction(run, { type: "move", move: "peck" }, 1700),
  );
  assert.deepEqual(run, snapshot);
  let previous = { softCurrency: 0, packTickets: 0, styleShards: 0 };
  for (let i = 0; i < 100; i++) {
    const next = waffleRewards({ waffles: i, wins: i });
    for (const key of ["softCurrency", "packTickets", "styleShards"] as const)
      assert(next[key] >= previous[key]);
    previous = next;
  }
  assert.deepEqual(previous, {
    softCurrency: 600,
    packTickets: 2,
    styleShards: 18,
  });
  assert.deepEqual(waffleRewards({ waffles: 3, wins: 0 }), {
    softCurrency: 20,
    packTickets: 0,
    styleShards: 0,
  });
});
