import assert from "node:assert/strict";
import test from "node:test";
import {
  canAffordSelection,
  chooseCpuPlay,
  createMatch,
  getDistrictResults,
  getMatchWinner,
  nextRound,
  pass,
  playCard,
  revealCpu,
  verifyMatchTranscript,
  type Lane,
  type PlayerMove,
} from "./gameEngine";
import {
  createStoryMatch,
  getActiveStoryPhase,
  getStoryLockedLanes,
  verifyStoryMatchTranscript,
  type StoryEncounterSnapshot,
} from "@workspace/squabblemon-engine/gameEngine";
import {
  getStoryBattle,
  storyContent,
  validateStoryContent,
  type StoryContent,
} from "@workspace/squabblemon-engine/story";

test("the server-verifiable transcript reproduces the local match", () => {
  let local = createMatch("block", "slide");
  const moves: PlayerMove[] = [];

  for (let round = 0; round < 6; round += 1) {
    const choice = local.playerHand
      .flatMap((card) =>
        ([0, 1, 2] as Lane[]).map((lane) => ({ card, lane })),
      )
      .find(({ card, lane }) =>
        canAffordSelection(local, "player", card.instanceId, lane),
      );

    if (choice) {
      moves.push({
        cardInstanceId: choice.card.instanceId,
        lane: choice.lane,
        squabble: false,
      });
      local = playCard(
        local,
        "player",
        choice.card.instanceId,
        choice.lane,
      );
    } else {
      moves.push({ cardInstanceId: null, lane: null, squabble: false });
      local = pass(local, "player");
    }
    local = revealCpu(local);
    local = nextRound(local);
  }

  const verified = verifyMatchTranscript("block", "slide", moves);
  assert.equal(getMatchWinner(verified), getMatchWinner(local));
  assert.deepEqual(getDistrictResults(verified), getDistrictResults(local));
});

test("illegal or incomplete transcripts are rejected", () => {
  assert.throws(() => verifyMatchTranscript("block", "slide", []));
  assert.throws(() =>
    verifyMatchTranscript(
      "block",
      "slide",
      Array.from({ length: 6 }, () => ({
        cardInstanceId: "forged-card",
        lane: 0 as Lane,
        squabble: false,
      })),
    ),
  );
});

test("prologue story content validates and malformed definitions are rejected", () => {
  assert.equal(validateStoryContent(storyContent), storyContent);
  assert.equal(storyContent.chapters[0].nodes.length, 6);
  const malformed = {
    ...storyContent,
    chapters: [{ ...storyContent.chapters[0], nodes: [{ ...storyContent.chapters[0].nodes[1], encounter: {
      ...(storyContent.chapters[0].nodes[1] as { encounter: StoryEncounterSnapshot }).encounter,
      enemy: { ...(storyContent.chapters[0].nodes[1] as { encounter: StoryEncounterSnapshot }).encounter.enemy, cardIds: ["forged"] },
    } }] }],
  } as unknown as StoryContent;
  assert.throws(() => validateStoryContent(malformed), /seven unique enemy cards/);
});

test("a story snapshot and six stored moves replay identically", () => {
  const snapshot = getStoryBattle("prologue-first-hand")!.encounter;
  const moves = Array.from({ length: 6 }, () => ({ cardInstanceId: null, lane: null, squabble: false }));
  const first = verifyStoryMatchTranscript(snapshot, "block", moves);
  const second = verifyStoryMatchTranscript(snapshot, "block", moves);
  assert.deepEqual(first, second);
  assert.throws(() => verifyStoryMatchTranscript(snapshot, "block", moves.slice(0, 5)), /six moves/);
});

test("story lane locks reject players and are excluded from CPU choices", () => {
  const base = getStoryBattle("prologue-roadwork")!.encounter;
  const snapshot: StoryEncounterSnapshot = {
    ...base,
    modifiers: { ...base.modifiers, laneLocks: [{ round: 1, owner: "both", lanes: [0, 1] }] },
  };
  let match = createStoryMatch(snapshot, "block");
  assert.deepEqual(getStoryLockedLanes(match), [0, 1]);
  assert.throws(() => playCard({ ...match, playerHype: 20 }, "player", match.playerHand[0].instanceId, 0), /locked/);
  match = { ...pass(match, "player"), cpuHype: 20 };
  assert.equal(chooseCpuPlay(match)?.lane, 2);
});

test("phase on-enter effects and logs are applied exactly once", () => {
  const base = getStoryBattle("prologue-first-hand")!.encounter;
  const snapshot: StoryEncounterSnapshot = {
    ...base,
    phases: [{
      id: "opening", name: "Opening", trigger: { kind: "round", atLeast: 1 },
      onEnter: [{ kind: "hype", owner: "cpu", amount: 3 }],
    }],
  };
  let match = createStoryMatch(snapshot, "block");
  assert.equal(getActiveStoryPhase(match)?.id, "opening");
  assert.equal(match.cpuHype, 4);
  assert.equal(match.effectLog.filter((entry) => entry.cardInstanceId === "story:phase:opening:0").length, 1);
  match = revealCpu(pass(match, "player"));
  assert.equal(match.cpuHype, 4 - (match.boards.flat().find((card) => card.owner === "cpu")?.cost ?? 0));
  assert.equal(match.effectLog.filter((entry) => entry.cardInstanceId === "story:phase:opening:0").length, 1);
});