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
  replayMatchPrefix,
  playCard,
  revealCpu,
  revealCpuTurn,
  verifyMatchTranscript,
  type Lane,
  type PlayerMove,
} from "./gameEngine";
import {
  createCardInstance,
  createStoryMatch,
  evaluateStoryStarObjectives,
  getActiveStoryPhase,
  getMatchRoundLimit,
  getStoryLockedLanes,
  getStoryStars,
  playTurnCard,
  verifyStoryMatchTranscript,
  type Match,
  type StoryEncounterSnapshot,
} from "@workspace/squabblemon-engine/gameEngine";

test("a valid transcript prefix replays to the same canonical decision state", () => {
  const initial = createMatch("block", "slide");
  const prefix = [{ cardInstanceId: null, lane: null, squabble: false, endTurn: true }];
  assert.deepEqual(replayMatchPrefix(initial, prefix), nextRound(revealCpuTurn(pass(initial, "player"))));
});
import {
  getStoryBattle,
  storyContent,
  validateStoryContent,
  type StoryContent,
} from "@workspace/squabblemon-engine/story";
import {
  ROOKIE_FOUNDATION_IDS,
  catalogIdsToEngineIds,
} from "@workspace/squabblemon-engine/data";

test("the server-verifiable transcript reproduces the local fade", () => {
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

test("later-season encounters use authored dialogue cards and preserve reveal order", () => {
  const later = storyContent.chapters.filter((chapter) => chapter.order >= 3);
  assert.equal(later.length, 17);
  for (const chapter of later) {
    for (const node of chapter.nodes) {
      const lines = node.kind === "battle"
        ? [...node.preDialogue, ...node.postDialogue]
        : node.scenes;
      const minimumLines = chapter.id.startsWith("special-") ? 2 : 4;
      assert.ok(lines.length >= minimumLines, `${node.id} needs a substantial scene`);
      for (const line of lines) {
        assert.ok(line.speaker.trim());
        assert.match(line.portraitAssetId, /^assets\/characters\/.+\.webp$/);
        assert.ok(line.text.trim());
      }
      if (node.kind === "battle") {
        const minimumSetupLines = chapter.id.startsWith("special-") ? 1 : 4;
        const minimumAftermathLines = chapter.id.startsWith("special-") ? 2 : 3;
        assert.ok(node.preDialogue.length >= minimumSetupLines, `${node.id} needs enough setup lines`);
        assert.ok(node.postDialogue.length >= minimumAftermathLines, `${node.id} needs enough aftermath lines`);
        assert.doesNotMatch(node.postDialogue.map((line) => line.text).join(" "), /Good game\. The next table is waiting/);
      }
    }
  }
  const chapterText = later.map((chapter) => chapter.nodes.flatMap((node) =>
    node.kind === "battle" ? [...node.preDialogue, ...node.postDialogue] : node.scenes,
  ).map((line) => line.text).join(" "));
  assert.match(chapterText[0], /sick|memorial|death story/i);
  assert.match(chapterText[1], /edited|continuous|address/i);
  assert.match(chapterText[2], /rescue|false memorial|warehouse/i);
  assert.match(chapterText[3], /equal.access|terms|contender/i);
  assert.match(chapterText[4], /crossed out|restor|disqualif/i);
  assert.match(chapterText[5], /sale agreement|owner|building/i);
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
  assert.throws(() => verifyStoryMatchTranscript(snapshot, "block", moves.slice(0, 5)), /six round endings/);
});

test("story lane locks reject players and are excluded from CPU choices", () => {
  const base = getStoryBattle("receipts-on-camera")!.encounter;
  const snapshot: StoryEncounterSnapshot = {
    ...base,
    modifiers: { ...base.modifiers, laneLocks: [{ round: 1, owner: "both", lanes: [0, 1] }] },
  };
  let match = createStoryMatch(snapshot, "block");
  assert.deepEqual(getStoryLockedLanes(match), [0, 1]);
  assert.throws(() => playCard({ ...match, playerMotion: 20 }, "player", match.playerHand[0].instanceId, 0), /locked/);
  match = { ...pass(match, "player"), cpuMotion: 20 };
  assert.equal(chooseCpuPlay(match)?.lane, 2);
});

test("phase on-enter effects and logs are applied exactly once", () => {
  const base = getStoryBattle("welcome-to-the-block")!.encounter;
  const snapshot: StoryEncounterSnapshot = {
    ...base,
    phases: [{
      id: "opening", name: "Opening", trigger: { kind: "round", atLeast: 1 },
      onEnter: [{ kind: "motion", owner: "cpu", amount: 3 }],
    }],
  };
  let match = createStoryMatch(snapshot, "block");
  assert.equal(getActiveStoryPhase(match)?.id, "opening");
  const phaseEntryMotion = Math.min(9, (base.modifiers?.startingMotion?.cpu ?? 2) + 3);
  assert.equal(match.cpuMotion, phaseEntryMotion);
  assert.equal(match.effectLog.filter((entry) => entry.cardInstanceId === "story:phase:opening:0").length, 1);
  match = revealCpu(pass(match, "player"));
  assert.equal(match.cpuMotion, phaseEntryMotion - (match.boards.flat().find((card) => card.owner === "cpu")?.cost ?? 0));
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

test("four-round story encounters complete and verify after four endings", () => {
  const snapshot = getStoryBattle("blue-side-pressure")!.encounter;
  assert.equal(getMatchRoundLimit(snapshot), 4);
  const moves = Array.from({ length: 4 }, () => ({ cardInstanceId: null, lane: null, squabble: false }));
  const verified = verifyStoryMatchTranscript(snapshot, "block", moves);
  assert.equal(verified.round, 4);
  assert.equal(verified.phase, "complete");
  assert.throws(() => verifyStoryMatchTranscript(snapshot, "block", moves.slice(0, 3)), /4 round endings/);
});

test("typed and legacy story objectives share one deterministic evaluator", () => {
  const snapshot = getStoryBattle("welcome-to-the-block")!.encounter;
  const base = createStoryMatch(snapshot, "block");
  const cardIds = ["cornball", "snow", "roaster"] as const;
  const boards = cardIds.map((cardId, lane) => [{
    ...createCardInstance(cardId, "player", "objective-test", lane),
    lane: lane as Lane,
    playedRound: 1,
    moved: lane === 0,
  }]) as Match["boards"];
  const completed: Match = {
    ...base,
    phase: "complete",
    round: getMatchRoundLimit(base),
    boards,
    playerMotion: 2,
    squabbleUsed: true,
  };
  assert.deepEqual(evaluateStoryStarObjectives(completed).map((objective) => objective.achieved), [true, true, true]);
  assert.equal(getStoryStars(completed), 3);

  const criteria = evaluateStoryStarObjectives(completed, [
    { id: "win-now", description: "win", criterion: { kind: "win" } },
    { id: "district-count", description: "districts", criterion: { kind: "districts-held", owner: "player", atLeast: 3 } },
    { id: "outside", description: "outside", criterion: { kind: "specific-districts-held", owner: "player", lanes: [0, 2] } },
    { id: "used", description: "squabble", criterion: { kind: "squabble-used", owner: "player", used: true } },
    { id: "motion", description: "motion", criterion: { kind: "motion-remaining", owner: "player", atLeast: 2 } },
    { id: "moved", description: "movement", criterion: { kind: "cards-moved", owner: "player", atLeast: 1 } },
  ]);
  assert.ok(criteria.every((objective) => objective.achieved));

  const legacy = evaluateStoryStarObjectives({ ...completed, squabbleUsed: false }, [
    { id: "win", description: "Win the encounter." },
    { id: "districts", description: "Finish holding all three districts." },
    { id: "squabble", description: "Win without using SQUABBLE." },
  ]);
  assert.ok(legacy.every((objective) => objective.achieved));
  assert.ok(evaluateStoryStarObjectives({ ...completed, phase: "resolved" }).every((objective) => !objective.achieved));
});

test("a moved card keeps story objective credit after it is destroyed", () => {
  const snapshot = getStoryBattle("welcome-to-the-block")!.encounter;
  const base = createStoryMatch(snapshot, "block");
  const mover = createCardInstance("vibe", "player", "movement-history", 0);
  const traveler = {
    ...createCardInstance("cornball", "player", "movement-history", 1),
    lane: 1 as Lane,
    playedRound: 1,
  };
  const afterMove = playTurnCard({
    ...base,
    playerHand: [mover],
    playerMotion: 10,
    boards: [[], [traveler], []],
  }, "player", mover.instanceId, 0);
  assert.equal(afterMove.boards[0].some(card => card.instanceId === traveler.instanceId), true);
  assert(afterMove.effectLog.some(event => event.kind === "move"));

  const laneOneWinner = {
    ...createCardInstance("hooper", "player", "movement-history", 2),
    lane: 1 as Lane,
    playedRound: 1,
  };
  const completed: Match = {
    ...afterMove,
    phase: "complete",
    round: getMatchRoundLimit(afterMove),
    boards: [
      afterMove.boards[0].filter(card => card.instanceId !== traveler.instanceId),
      [laneOneWinner],
      [],
    ],
  };
  assert(!completed.boards.flat().some(card => card.moved));
  const [objective] = evaluateStoryStarObjectives(completed, [{
    id: "movement-history",
    description: "Move a card even if it leaves play.",
    criterion: { kind: "cards-moved", owner: "player", atLeast: 1 },
  }]);
  assert.equal(objective.achieved, true);
});
test("Chapters Three through Eight apply the authored pacing and reward tiers", () => {
  const lateChapters = storyContent.chapters.filter(({ order }) => order >= 3 && order <= 8);
  assert.deepEqual(lateChapters.map(({ order }) => order), [3, 4, 5, 6, 7, 8]);

  const xpByBattleType = {
    guided: 75,
    standard: 90,
    "rule-twist": 110,
    "mini-boss": 150,
    boss: 225,
  } as const;

  for (const chapter of lateChapters) {
    const battles = chapter.nodes.filter((node) => node.kind === "battle");
    assert.ok(battles.length >= 3, `${chapter.id} should contain at least three battles`);

    for (const [battleIndex, battle] of battles.entries()) {
      const expectedRoundLimit = battle.optional || battleIndex === 0 || battle.battleType === "guided"
        ? 4
        : battle.battleType === "rule-twist"
          ? 5
          : 6;
      assert.equal(
        getMatchRoundLimit(battle.encounter),
        expectedRoundLimit,
        `${battle.id} should run for ${expectedRoundLimit} rounds`,
      );

      const streetXp = battle.rewards.filter(
        (reward) => reward.kind === "currency" && reward.id === "street-xp",
      );
      assert.deepEqual(
        streetXp.map(({ amount }) => amount),
        [battle.optional ? 125 : xpByBattleType[battle.battleType]],
        `${battle.id} should use its battle tier's Account XP reward`,
      );
    }
  }
});

test("late campaign objectives vary by chapter and remain embedded in each encounter", () => {
  for (const chapter of storyContent.chapters.filter(({ order }) => order >= 3 && order <= 8)) {
    const battles = chapter.nodes.filter((node) => node.kind === "battle");
    const signatures = new Set<string>();

    for (const battle of battles) {
      assert.equal(battle.starObjectives.length, 3, `${battle.id} should have three objectives`);
      assert.ok(
        battle.starObjectives.every((objective) => objective.criterion),
        `${battle.id} should use typed objective criteria`,
      );
      assert.deepEqual(
        battle.encounter.starObjectives,
        battle.starObjectives,
        `${battle.id} should embed the exact objectives used by its story node`,
      );
      signatures.add(JSON.stringify(battle.starObjectives.map(({ criterion }) => criterion)));
    }

    if (battles.length >= 3) {
      assert.ok(
        signatures.size >= 3,
        `${chapter.id} should offer at least three distinct objective sets`,
      );
    }
  }
});

test("late campaign phase timing fits every shortened encounter and validates", () => {
  assert.equal(validateStoryContent(storyContent), storyContent);

  for (const chapter of storyContent.chapters.filter(({ order }) => order >= 3 && order <= 8)) {
    for (const node of chapter.nodes) {
      if (node.kind !== "battle") continue;
      const roundLimit = getMatchRoundLimit(node.encounter);
      for (const storyPhase of node.encounter.phases ?? []) {
        if (storyPhase.trigger.kind !== "round") continue;
        assert.ok(
          storyPhase.trigger.atLeast <= roundLimit,
          `${node.id} phase ${storyPhase.id} should trigger by round ${roundLimit}`,
        );
      }
    }
  }
});

test("early campaign balance content retains IDs, rewards, and authored encounter rules", () => {
  assert.equal(storyContent.version, 6);
  assert.equal(storyContent.chapters.flatMap((chapter) => chapter.nodes).length, 119);
  assert.equal(storyContent.chapters.flatMap((chapter) => chapter.nodes).filter((node) => node.kind === "battle").length, 81);

  const newAccountCards = new Set(catalogIdsToEngineIds(ROOKIE_FOUNDATION_IDS));
  for (const chapter of storyContent.chapters.filter(({ order }) => order <= 2)) {
    for (const node of chapter.nodes) {
      if (node.kind === "battle") {
        for (const cardId of new Set([...node.teaching.focusCards, ...node.recommendedCollection])) {
          assert.ok(newAccountCards.has(cardId), node.id + " recommends unavailable new-account card " + cardId);
        }
      }
      for (const reward of node.rewards) {
        if (reward.kind === "card") newAccountCards.add(reward.id);
      }
    }
  }

  const welcome = getStoryBattle("welcome-to-the-block")!;
  assert.deepEqual(welcome.starObjectives.find((objective) => objective.id === "squabble")?.criterion, {
    kind: "squabble-used", owner: "player", used: true,
  });
  assert.equal(getStoryBattle("blue-side-pressure")!.encounter.roundLimit, 4);
  assert.equal(getStoryBattle("red-tapes-cheese-has-terms")!.encounter.roundLimit, 4);
  assert.equal(getStoryBattle("red-tapes-roast-with-a-receipt")!.encounter.modifiers?.startingMotion?.cpu, 3);

  const wifey = getStoryBattle("red-tapes-side-eye-security")!;
  assert.equal(wifey.battleType, "mini-boss");
  assert.equal(wifey.encounter.modifiers?.handSize?.cpu, 6);
  assert.equal(createStoryMatch(wifey.encounter, "block").cpuHand.length, 6);

  const chapterTwo = storyContent.chapters.find((chapter) => chapter.id === "red-side-tapes")!;
  const courier = chapterTwo.nodes.find((node) => node.id === "red-tapes-courier-table")!;
  assert.equal(courier.kind, "reward");
  assert.equal(courier.optional, true);
  assert.deepEqual(courier.prerequisites, ["red-tapes-red-side-open"]);
  assert.deepEqual(courier.rewards.map(({ kind, id, amount }) => ({ kind, id, amount })), [
    { kind: "currency", id: "street-xp", amount: 75 },
    { kind: "pack-ticket", id: "street-pack-ticket", amount: 1 },
  ]);
  assert.equal(courier.rewards[1].claimKey, "red-tapes-courier-table:stars:3:auto-ticket:v1");
  assert.equal(chapterTwo.nodes.filter((node) => node.kind === "battle").length, 6);
  assert.ok(storyContent.chapters.flatMap((chapter) => chapter.nodes)
    .filter((node) => node.kind === "battle")
    .every((node) => node.starObjectives.length === 3 && node.starObjectives.every((objective) => objective.criterion)));
});
