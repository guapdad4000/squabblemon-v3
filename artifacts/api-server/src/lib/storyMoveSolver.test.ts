import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import {
  ROOKIE_CORE_IDS,
  ROOKIE_DECK_ID,
  ROOKIE_MENTOR_CORE_IDS,
  catalogIdsToEngineIds,
} from "@workspace/squabblemon-engine/data";
import {
  createDistrictSnapshot,
  createStoryMatch,
  getMatchWinner,
  nextRound,
  pass,
  playTurnCard,
  revealCpuTurn,
  suppressMatchPresentationEvents,
  verifyStoryMatchTranscript,
  type Match,
  type PlayerMove,
} from "@workspace/squabblemon-engine/gameEngine";
import { getStoryBattle } from "@workspace/squabblemon-engine/story";
import {
  STORY_SOLVER_NODE_BUDGET_MS,
  solveStoryMoves,
} from "./storyMoveSolver";

function replay(initial: Match, moves: readonly PlayerMove[]): Match {
  let match = initial;
  for (const move of moves) {
    if (move.cardInstanceId === null) {
      match = pass(match, "player");
    } else {
      assert.notEqual(move.lane, null);
      match = playTurnCard(
        match,
        "player",
        move.cardInstanceId,
        move.lane!,
        move.squabble,
      );
      if (move.endTurn === true) match = pass(match, "player");
    }
    if (match.phase === "cpu-reveal") {
      match = nextRound(revealCpuTurn(match));
    }
  }
  return match;
}

function gameplayState(match: Match): unknown {
  const {
    effectLog: _effectLog,
    nextEventSequence: _nextEventSequence,
    ...gameplay
  } = match;
  // JSON intentionally omits the internal Symbol search marker.
  return JSON.parse(JSON.stringify(gameplay));
}

test("fresh rookie crew solves the guided opening within the node ceiling", {
  timeout: STORY_SOLVER_NODE_BUDGET_MS + 2_000,
}, () => {
  const battle = getStoryBattle("welcome-to-the-block");
  assert(battle);
  const cards = catalogIdsToEngineIds(ROOKIE_CORE_IDS);
  const districts = createDistrictSnapshot(
    "story-node-v1:welcome-to-the-block",
  );
  const initial = performance.now();
  const moves = solveStoryMoves(
    createStoryMatch(
      battle.encounter,
      cards,
      ROOKIE_DECK_ID,
      undefined,
      districts,
    ),
  );
  const elapsed = performance.now() - initial;
  const completed = verifyStoryMatchTranscript(
    battle.encounter,
    cards,
    moves,
    ROOKIE_DECK_ID,
    undefined,
    districts,
  );
  assert.equal(getMatchWinner(completed), "player");
  assert(
    elapsed <= STORY_SOLVER_NODE_BUDGET_MS + 500,
    `opening solve took ${elapsed.toFixed(1)}ms`,
  );
});

test("OG Uncle boss keeps both phases and has a bounded fresh-roster win", {
  timeout: STORY_SOLVER_NODE_BUDGET_MS + 2_000,
}, () => {
  const battle = getStoryBattle("og-uncles-verdict");
  assert(battle);
  assert.equal(battle.encounter.phases?.length, 2);
  assert.equal(battle.encounter.modifiers?.handSize?.cpu, 4);
  assert.equal(battle.encounter.modifiers?.lanePowerBonuses, undefined);
  const cards = catalogIdsToEngineIds(ROOKIE_CORE_IDS);
  const districts = createDistrictSnapshot("story-node-v1:og-uncles-verdict");
  const startedAt = performance.now();
  const moves = solveStoryMoves(
    createStoryMatch(
      battle.encounter,
      cards,
      ROOKIE_DECK_ID,
      undefined,
      districts,
    ),
  );
  const elapsed = performance.now() - startedAt;
  const completed = verifyStoryMatchTranscript(
    battle.encounter,
    cards,
    moves,
    ROOKIE_DECK_ID,
    undefined,
    districts,
  );
  assert.equal(getMatchWinner(completed), "player");
  assert(
    elapsed <= STORY_SOLVER_NODE_BUDGET_MS + 500,
    `OG Uncle solve took ${elapsed.toFixed(1)}ms`,
  );
});

test("Bar Fight keeps its center lock and has a bounded fresh-roster win", {
  timeout: STORY_SOLVER_NODE_BUDGET_MS + 2_000,
}, () => {
  const battle = getStoryBattle("the-bar-fight");
  assert(battle);
  assert.equal(battle.encounter.roundLimit, 5);
  assert.equal(battle.encounter.modifiers?.startingMotion?.player, 3);
  assert.deepEqual(battle.encounter.modifiers?.laneLocks, [
    { round: 3, owner: "both", lanes: [1] },
  ]);
  const cards = catalogIdsToEngineIds(ROOKIE_CORE_IDS);
  const districts = createDistrictSnapshot("story-node-v1:the-bar-fight");
  const startedAt = performance.now();
  const moves = solveStoryMoves(
    createStoryMatch(
      battle.encounter,
      cards,
      ROOKIE_DECK_ID,
      undefined,
      districts,
    ),
  );
  const elapsed = performance.now() - startedAt;
  const completed = verifyStoryMatchTranscript(
    battle.encounter,
    cards,
    moves,
    ROOKIE_DECK_ID,
    undefined,
    districts,
  );
  assert.equal(getMatchWinner(completed), "player");
  assert(
    elapsed <= STORY_SOLVER_NODE_BUDGET_MS + 500,
    `Bar Fight solve took ${elapsed.toFixed(1)}ms`,
  );
});
test("Crown Open Entry keeps its guided length and has a bounded fresh-roster win", {
  timeout: STORY_SOLVER_NODE_BUDGET_MS + 2_000,
}, () => {
  const battle = getStoryBattle("crown-open-entry");
  assert(battle);
  assert.equal(battle.encounter.roundLimit, 4);
  assert.equal(battle.encounter.modifiers?.startingMotion?.player, 3);
  const cards = catalogIdsToEngineIds(ROOKIE_CORE_IDS);
  const districts = createDistrictSnapshot("story-node-v1:crown-open-entry");
  const startedAt = performance.now();
  const moves = solveStoryMoves(
    createStoryMatch(
      battle.encounter,
      cards,
      ROOKIE_DECK_ID,
      undefined,
      districts,
    ),
  );
  const elapsed = performance.now() - startedAt;
  const completed = verifyStoryMatchTranscript(
    battle.encounter,
    cards,
    moves,
    ROOKIE_DECK_ID,
    undefined,
    districts,
  );
  assert.equal(getMatchWinner(completed), "player");
  assert(
    elapsed <= STORY_SOLVER_NODE_BUDGET_MS + 500,
    `Crown Open Entry solve took ${elapsed.toFixed(1)}ms`,
  );
});

test("Crown Hooper keeps its semifinal phase and has a bounded fresh-roster win", {
  timeout: STORY_SOLVER_NODE_BUDGET_MS + 2_000,
}, () => {
  const battle = getStoryBattle("crown-hoopers-seed");
  assert(battle);
  assert.equal(battle.encounter.modifiers?.startingMotion?.player, 3);
  assert.equal(battle.encounter.phases?.length, 1);
  assert.equal(battle.encounter.phases?.[0]?.id, "semifinal-push");
  assert.deepEqual(battle.encounter.phases?.[0]?.trigger, {
    kind: "round",
    atLeast: 4,
  });
  assert.deepEqual(battle.encounter.phases?.[0]?.onEnter, [
    { kind: "motion", owner: "cpu", amount: 1 },
  ]);
  const cards = catalogIdsToEngineIds(ROOKIE_CORE_IDS);
  const districts = createDistrictSnapshot("story-node-v1:crown-hoopers-seed");
  const startedAt = performance.now();
  const moves = solveStoryMoves(
    createStoryMatch(
      battle.encounter,
      cards,
      ROOKIE_DECK_ID,
      undefined,
      districts,
    ),
  );
  const elapsed = performance.now() - startedAt;
  const completed = verifyStoryMatchTranscript(
    battle.encounter,
    cards,
    moves,
    ROOKIE_DECK_ID,
    undefined,
    districts,
  );
  assert.equal(getMatchWinner(completed), "player");
  assert(
    elapsed <= STORY_SOLVER_NODE_BUDGET_MS + 500,
    `Crown Hooper solve took ${elapsed.toFixed(1)}ms`,
  );
});

test("Pledge Drive Final keeps its announced phases and has a bounded campaign-crew win", {
  timeout: STORY_SOLVER_NODE_BUDGET_MS + 2_000,
}, () => {
  const battle = getStoryBattle("s2-pledge-drive-final");
  assert(battle);
  assert.equal(battle.encounter.roundLimit, 6);
  assert.equal(battle.encounter.phases?.length, 2);
  assert.equal(battle.encounter.modifiers?.handSize?.cpu, 3);
  assert.equal(battle.encounter.starObjectives?.length, 3);
  const campaignCrew = [...ROOKIE_MENTOR_CORE_IDS];
  campaignCrew[5] = "nail-tech";
  const cards = catalogIdsToEngineIds(campaignCrew);
  const districts = createDistrictSnapshot(
    "story-node-v1:s2-pledge-drive-final",
  );
  const startedAt = performance.now();
  const moves = solveStoryMoves(
    createStoryMatch(
      battle.encounter,
      cards,
      ROOKIE_DECK_ID,
      undefined,
      districts,
    ),
  );
  const elapsed = performance.now() - startedAt;
  const completed = verifyStoryMatchTranscript(
    battle.encounter,
    cards,
    moves,
    ROOKIE_DECK_ID,
    undefined,
    districts,
  );
  assert.equal(getMatchWinner(completed), "player");
  assert(
    elapsed <= STORY_SOLVER_NODE_BUDGET_MS + 500,
    `Pledge Drive Final solve took ${elapsed.toFixed(1)}ms`,
  );
});

test("suppressed presentation events preserve complete boss gameplay state", {
  timeout: STORY_SOLVER_NODE_BUDGET_MS + 3_000,
}, () => {
  const battle = getStoryBattle("cracked-head-takes-the-block");
  assert(battle);
  const cards = catalogIdsToEngineIds(ROOKIE_CORE_IDS);
  const districts = createDistrictSnapshot(
    "story-node-v1:cracked-head-takes-the-block",
  );
  const initial = createStoryMatch(
    battle.encounter,
    cards,
    ROOKIE_DECK_ID,
    undefined,
    districts,
  );
  const moves = solveStoryMoves(initial);
  const normal = replay(initial, moves);
  const suppressed = replay(
    suppressMatchPresentationEvents(initial),
    moves,
  );

  assert(
    moves.some((move, index) =>
      move.cardInstanceId !== null &&
      moves[index + 1]?.cardInstanceId !== null,
    ),
    "parity transcript must exercise a multi-card player turn",
  );
  assert(
    moves.some(move => move.cardInstanceId?.endsWith(":wifey")),
    "parity transcript must exercise a timed protection effect",
  );
  assert(normal.districtRuntime);
  assert.equal(normal.storyRuntime?.activePhaseIndex, 2);
  assert(normal.effectLog.some(event => event.duration?.unit === "round"), "replay includes timed effects even if they expire before the final round");
  assert(normal.effectLog.length > 0);
  assert.equal(suppressed.effectLog.length, 0);
  assert.deepEqual(gameplayState(suppressed), gameplayState(normal));
});