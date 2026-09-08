import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

test("Block Party content validates and rejects unknown cards, cycles, and optional gates", () => {
  assert.equal(validateStoryContent(storyContent), storyContent);
  assert.equal(storyContent.chapters[0].id, "block-party");
  assert.equal(storyContent.chapters[0].nodes.length, 8);
  const malformed = {
    ...storyContent,
    chapters: [{ ...storyContent.chapters[0], nodes: [{ ...storyContent.chapters[0].nodes[1], prerequisites: [], encounter: {
      ...(storyContent.chapters[0].nodes[1] as { encounter: StoryEncounterSnapshot }).encounter,
      enemy: { ...(storyContent.chapters[0].nodes[1] as { encounter: StoryEncounterSnapshot }).encounter.enemy, cardIds: ["forged"] },
    } }] }],
  } as unknown as StoryContent;
  assert.throws(() => validateStoryContent(malformed), /battle .* incomplete/);
  const optionalGate = {
    ...storyContent,
    chapters: [{
      ...storyContent.chapters[0],
      nodes: storyContent.chapters[0].nodes.map((node) => node.id === "receipts-on-camera"
        ? { ...node, prerequisites: ["side-alley-challenge"] }
        : node),
    }],
  } as StoryContent;
  assert.throws(() => validateStoryContent(optionalGate), /optional node/);
  const cycle = {
    ...storyContent,
    chapters: [{
      ...storyContent.chapters[0],
      nodes: storyContent.chapters[0].nodes.map((node) => node.id === "welcome-to-the-block"
        ? { ...node, prerequisites: ["cracked-head-takes-the-block"] }
        : node),
    }],
  } as StoryContent;
  assert.throws(() => validateStoryContent(cycle), /cycles or unreachable/);
});

test("every Chapter One media and portrait reference exists in public assets", () => {
  const publicRoot = new URL("../public/", import.meta.url);
  const references = new Set<string>();
  for (const chapter of storyContent.chapters) {
    references.add(chapter.mapAssetId);
    for (const node of chapter.nodes) {
      references.add(node.cinematic.videoAssetId);
      references.add(node.cinematic.posterAssetId);
      references.add(node.cinematic.environmentAssetId);
      const dialogue = node.kind === "battle"
        ? [...node.preDialogue, ...node.postDialogue]
        : node.scenes;
      for (const entry of dialogue) references.add(entry.portraitAssetId);
      if (node.kind === "battle") {
        references.add(node.encounter.enemy.portraitAssetId);
        references.add(node.encounter.battlefieldAssetId);
      }
    }
  }
  const missing = [...references].filter((assetId) =>
    !existsSync(fileURLToPath(new URL(assetId, publicRoot))),
  );
  assert.deepEqual(missing, []);
});

test("a story snapshot and six stored moves replay identically", () => {
  const snapshot = getStoryBattle("welcome-to-the-block")!.encounter;
  const moves = Array.from({ length: 6 }, () => ({ cardInstanceId: null, lane: null, squabble: false }));
  const first = verifyStoryMatchTranscript(snapshot, "block", moves);
  const second = verifyStoryMatchTranscript(snapshot, "block", moves);
  assert.deepEqual(first, second);
  assert.throws(() => verifyStoryMatchTranscript(snapshot, "block", moves.slice(0, 5)), /six moves/);
});

test("story lane locks reject players and are excluded from CPU choices", () => {
  const base = getStoryBattle("receipts-on-camera")!.encounter;
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
  const base = getStoryBattle("welcome-to-the-block")!.encounter;
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

test("Cracked Head has three deterministic telegraphed phases", () => {
  const snapshot = getStoryBattle("cracked-head-takes-the-block")!.encounter;
  assert.deepEqual(snapshot.phases?.map((phase) => phase.id), [
    "territory-claim", "pressure-cooker", "last-call",
  ]);
  assert.ok(snapshot.phases?.every((phase) => phase.description));
  // Accelerate the conditional middle phase to prove all three one-time effects
  // are replayed deterministically without requiring a particular player transcript.
  const accelerated: StoryEncounterSnapshot = {
    ...snapshot,
    phases: snapshot.phases?.map((phase, index) => index === 1
      ? { ...phase, trigger: { kind: "round" as const, atLeast: 2 } }
      : phase),
  };
  let match = createStoryMatch(accelerated, "block");
  assert.equal(getActiveStoryPhase(match)?.id, "territory-claim");
  for (let round = 0; round < 4; round += 1) {
    match = revealCpu(pass(match, "player"));
    match = nextRound(match);
  }
  assert.equal(getActiveStoryPhase(match)?.id, "last-call");
  assert.equal(match.cpuHand.filter((card) => card.cardId === "snow").length, 1);
});