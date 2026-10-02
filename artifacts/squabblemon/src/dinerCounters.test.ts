import test from "node:test";
import assert from "node:assert/strict";
import { cards, decks } from "../../../lib/squabblemon-engine/src/data";
import {
  createCardInstance,
  createMatch,
  createMatchFromEngineCards,
  DISTRICT_CATALOG,
  getCharacterDistrictMarks,
  getStoryLockedLanes,
  nextRound,
  playTurnCard,
  replayMatchPrefix,
  type CardInstance,
  type DistrictSnapshot,
  type Lane,
  type Match,
  type Owner,
} from "../../../lib/squabblemon-engine/src/gameEngine";
import { totalXpForCardLevel } from "../../../lib/squabblemon-engine/src/cardProgression";
import {
  createOnlineRoom,
  joinOnlineRoom,
  onlineRoomView,
} from "../../../lib/squabblemon-engine/src/multiplayer";

const freshMatch = (): Match => {
  const match = createMatch("block", "block");
  return {
    ...match,
    playerHand: [],
    cpuHand: [],
    playerCardIds: [],
    cpuCardIds: [],
    playerDrawIndex: 0,
    cpuDrawIndex: 0,
    playerMotion: 9,
    cpuMotion: 9,
    boards: [[], [], []],
    districtTraps: [],
    timedEffects: [],
    effectLog: [],
    nextEventSequence: 1,
    roundMovedIds: { player: [], cpu: [] },
  };
};

const freshMatchWithCardLevel = (cardId: string, level: number, owner: Owner = "player"): Match => {
  const ids = [cardId, ...Object.keys(cards)
    .filter(id => id !== cardId).slice(0, 9)];
  const progression = owner === "player"
    ? { player: { [cardId]: { xp: totalXpForCardLevel(level), level } } }
    : { cpu: { [cardId]: { xp: totalXpForCardLevel(level), level } } };
  const trained = createMatchFromEngineCards("diner-counter-test", ids, "diner-counter-cpu", ids,
    undefined, progression);
  return { ...freshMatch(), abilityUpgradeSnapshot: trained.abilityUpgradeSnapshot };
};
const freshMatchWithCashierLevel = (level: number) =>
  freshMatchWithCardLevel("squabblehouse-cashier", level);

function character(
  cardId: string,
  owner: Owner,
  lane: Lane,
  index: number,
  patch: Partial<CardInstance> = {},
): CardInstance {
  return {
    ...createCardInstance(cardId, owner, "diner-counter-test", index),
    lane,
    playedRound: 1,
    ...patch,
  };
}

function setBoard(match: Match, ...characters: CardInstance[]): Match {
  return {
    ...match,
    boards: [0, 1, 2].map(lane =>
      characters.filter(card => card.lane === lane)) as Match["boards"],
  };
}

const boardCard = (match: Match, instanceId: string) =>
  match.boards.flat().find(card => card.instanceId === instanceId);

function play(
  match: Match,
  cardId: string,
  owner: Owner,
  lane: Lane,
  index: number,
  patch: Partial<CardInstance> = {},
): Match {
  const source = {
    ...createCardInstance(cardId, owner, "diner-counter-test", index),
    ...patch,
  };
  const staged = owner === "player"
    ? { ...match, phase: "player" as const, playerHand: [source], playerMotion: 9 }
    : { ...match, phase: "cpu-reveal" as const, cpuHand: [source], cpuMotion: 9 };
  return playTurnCard(staged, owner, source.instanceId, lane, false);
}

const openTab = (match: Match, owner: Owner = "player", lane: Lane = 0) =>
  (match.districtTraps ?? []).find(trap =>
    trap.kind === "open-tab" && trap.owner === owner && trap.lane === lane);
const tabMark = (match: Match, owner: Owner = "player", lane: Lane = 0) =>
  getCharacterDistrictMarks(match).find(mark =>
    mark.owner === owner && mark.lane === lane && mark.text.startsWith("Open Tab"));

function endRound(match: Match): Match {
  return nextRound({
    ...match,
    phase: "resolved",
    playerCardIds: [],
    cpuCardIds: [],
    playerDrawIndex: 0,
    cpuDrawIndex: 0,
  });
}

test("Cashier places one departure receipt for either owner; arrival is unaffected", () => {
  for (const owner of ["player", "cpu"] as const) {
    const enemy = owner === "player" ? "cpu" : "player";
    let match = play(freshMatch(), "squabblehouse-cashier", owner, 0, 1);
    const receipt = openTab(match, owner);
    assert.ok(receipt);
    assert.equal(receipt.expiresAfterRound, 2);
    assert.equal(receipt.spentRound, undefined);
    assert.match(tabMark(match, owner)!.text, /ready this round · through R2/);

    match = play(match, "cornball", enemy, 0, 2);
    assert.ok(boardCard(match, `${enemy}:diner-counter-test:2:cornball`),
      "Open Tab does not prevent an enemy from being deployed into the district");
    assert.equal(openTab(match, owner)?.spentRound, undefined);

    match = play(match, "redside1", enemy, 0, 3);
    const mover = boardCard(match, `${enemy}:diner-counter-test:3:redside1`);
    assert.equal(mover?.lane, 0, "the mover remains in the receipt's district");
    assert.equal(mover?.powerModifier, 0, "a stopped move gets no move reward");
    assert.equal(openTab(match, owner)?.spentRound, 1);
    assert.match(tabMark(match, owner)!.text, /spent this round · through R2/);
    assert.equal(mover?.squabblehouseCannotMoveThroughRound, undefined,
      "a reveal with no enemy character does not retroactively lock later arrivals");
  }
});

test("Pay Your Tab locks the strongest enemy character through the next round for either owner", () => {
  for (const owner of ["player", "cpu"] as const) {
    const enemy = owner === "player" ? "cpu" : "player";
    const strongest = character("alice", enemy, 0, 10, { basePower: 20 });
    const weaker = character("cornball", enemy, 0, 11, { basePower: 2 });
    let match = play(setBoard(freshMatch(), strongest, weaker), "squabblehouse-cashier", owner, 0, 12);
    const selected = boardCard(match, strongest.instanceId);
    assert.equal(selected?.squabblehouseCannotMoveThroughRound, 2);
    assert.equal(boardCard(match, weaker.instanceId)?.squabblehouseCannotMoveThroughRound, undefined,
      "only the strongest enemy character receives the lock");
    assert.equal(openTab(match, owner)?.expiresAfterRound, 2,
      "the departure receipt is armed alongside the targeted lock");
    assert.ok(selected?.lastEffectNote.includes("through the end of next round"));

    match = endRound(match);
    assert.equal(match.round, 2);
    assert.ok(boardCard(match, strongest.instanceId),
      "the locked Alice cannot return to hand before the next round ends");
    match = endRound(match);
    assert.equal(match.round, 3);
    assert.ok(boardCard(match, strongest.instanceId));
    match = endRound(match);
    assert.equal(match.round, 4);
    assert.equal(boardCard(match, strongest.instanceId), undefined,
      "the move/return lock expires after round two");
    assert.ok(match[enemy === "player" ? "playerHand" : "cpuHand"].some(card => card.instanceId === strongest.instanceId),
      "Alice's deferred voluntary return becomes legal when the lock expires");
  }
});

test("Cashier's separate Open Tab charge catches an unlocked hand return", () => {
  for (const owner of ["player", "cpu"] as const) {
    const enemy = owner === "player" ? "cpu" : "player";
    const strongest = character("hooper", enemy, 0, 20, { basePower: 20 });
    const alice = character("alice", enemy, 0, 21, { basePower: 2 });
    const match = play(setBoard(freshMatch(), strongest, alice), "squabblehouse-cashier", owner, 0, 22);
    assert.equal(boardCard(match, strongest.instanceId)?.squabblehouseCannotMoveThroughRound, 2);
    assert.equal(boardCard(match, alice.instanceId)?.squabblehouseCannotMoveThroughRound, undefined);

    const afterReturnAttempt = endRound(match);
    assert.ok(boardCard(afterReturnAttempt, alice.instanceId),
      "the less powerful Alice is not covered by the per-card lock");
    assert.equal(openTab(afterReturnAttempt, owner)?.spentRound, 1,
      "Open Tab stops Alice's first legal move or hand return independently");
    assert.ok(!afterReturnAttempt[enemy === "player" ? "playerHand" : "cpuHand"]
      .some(card => card.instanceId === alice.instanceId));
  }
});

test("Open Tab is route-gated, respects protection and immunity, and survives its source leaving", () => {
  let match = play(freshMatch(), "squabblehouse-cashier", "player", 0, 1);
  const cashierId = "player:diner-counter-test:1:squabblehouse-cashier";

  match = setBoard(match,
    ...match.boards.flat().map(card => card.instanceId === cashierId
      ? { ...card, statuses: { ...card.statuses, silenced: true } }
      : card),
    ...[10, 11, 12, 13, 14, 15, 16, 17].map((index, i) =>
      character("cornball", "cpu", i < 4 ? 1 : 2, index)),
  );
  match = play(match, "redside1", "cpu", 0, 20);
  assert.equal(boardCard(match, "cpu:diner-counter-test:20:redside1")?.lane, 0);
  assert.equal(openTab(match)?.spentRound, undefined,
    "a movement with no legal destination does not spend the receipt");

  match = {
    ...match,
    boards: [match.boards[0].filter(card => card.instanceId !== cashierId), [], []],
  };
  match = play(match, "redside1", "cpu", 0, 21);
  assert.equal(boardCard(match, "cpu:diner-counter-test:21:redside1")?.lane, 0);
  assert.equal(openTab(match)?.spentRound, 1);
  assert.equal(boardCard(match, cashierId), undefined, "the counter is no longer on the board");

  const protectedMatch = play(freshMatch(), "squabblehouse-cashier", "player", 0, 30);
  const protectedRunner = {
    ...createCardInstance("redside1", "cpu", "diner-counter-test", 31),
    statuses: { ...createCardInstance("redside1", "cpu", "diner-counter-test", 31).statuses, protected: true },
  };
  const shielded = {
    ...protectedMatch,
    timedEffects: [{
      id: "test-church-shield",
      kind: "church-protection" as const,
      sourceInstanceId: "test-protection-source",
      targetInstanceId: protectedRunner.instanceId,
      owner: "cpu" as const,
      lane: 0 as const,
      startsAtRound: 1,
      expiresAtRound: 3,
      expiration: "round-start" as const,
    }],
  };
  const afterShield = play(shielded, "redside1", "cpu", 0, 31, {
    statuses: protectedRunner.statuses,
  });
  assert.equal(boardCard(afterShield, protectedRunner.instanceId)?.lane, 1,
    "the shield absorbs the counter and permits the original move");
  assert.equal(boardCard(afterShield, protectedRunner.instanceId)?.statuses.protected, false);
  assert.equal(afterShield.timedEffects.some(effect => effect.id === "test-church-shield"), false);
  assert.equal(openTab(afterShield)?.spentRound, undefined);

  const immuneMatch = play(freshMatch(), "squabblehouse-cashier", "player", 0, 40);
  const afterImmunity = play(immuneMatch, "redside1", "cpu", 0, 41, {
    statuses: {
      ...createCardInstance("redside1", "cpu", "diner-counter-test", 41).statuses,
      uncounterable: true,
    },
  });
  assert.equal(boardCard(afterImmunity, "cpu:diner-counter-test:41:redside1")?.lane, 1);
  assert.equal(openTab(afterImmunity)?.spentRound, undefined,
    "an immune mover can leave without using the receipt");
});

test("paired Scarecrow movement is preflighted atomically when Open Tab blocks either traveler", () => {
  const ally = character("cornball", "cpu", 1, 51);
  let match = play(freshMatch(), "squabblehouse-cashier", "player", 1, 52);
  match = setBoard(match, ally);
  const beforeScarecrow = match;
  assert.ok(openTab(beforeScarecrow, "player", 1));
  match = play(match, "scarecrow", "cpu", 0, 53);

  assert.equal(boardCard(match, "cpu:diner-counter-test:53:scarecrow")?.lane, 0);
  assert.equal(boardCard(match, ally.instanceId)?.lane, 1);
  assert.equal(boardCard(match, ally.instanceId)?.powerModifier, 0);
  assert.equal(boardCard(match, "cpu:diner-counter-test:53:scarecrow")?.powerModifier, 0);
  assert.equal(openTab(match, "player", 1)?.spentRound, 1);
  assert.ok(beforeScarecrow.boards[1].some(card => card.instanceId === ally.instanceId));
});

test("full-district swaps remain legal, while an invalid Vibe move leaves Open Tab ready for either owner", () => {
  const swapAllies = [
    ...[1, 2, 3].map(index => character("hooper", "player", 0, 130 + index)),
    character("cornball", "player", 1, 134),
    ...[5, 6, 7].map(index => character("hooper", "player", 1, 130 + index)),
  ];
  const swapped = play(setBoard(freshMatch(), ...swapAllies), "scarecrow", "player", 0, 138);
  assert.equal(boardCard(swapped, "player:diner-counter-test:138:scarecrow")?.lane, 1);
  assert.equal(swapped.boards[0].filter(card => card.owner === "player").length, 4);
  assert.equal(swapped.boards[1].filter(card => card.owner === "player").length, 4);
  assert.equal(boardCard(swapped, "player:diner-counter-test:134:cornball")?.lane, 0,
    "the incoming ally frees a slot in the original district as part of the atomic swap");

  for (const owner of ["player", "cpu"] as const) {
    const receiptOwner = owner === "player" ? "cpu" : "player";
    let match = play(freshMatch(), "squabblehouse-cashier", receiptOwner, 1, 139);
    const fullDistrict = [140, 141, 142].map(index => character("hooper", owner, 0, index));
    const remoteAlly = character("cornball", owner, 1, 143);
    match = setBoard(match, ...match.boards.flat(), ...fullDistrict, remoteAlly);
    match = play(match, "vibe", owner, 0, 144);

    assert.equal(boardCard(match, remoteAlly.instanceId)?.lane, 1);
    assert.equal(boardCard(match, remoteAlly.instanceId)?.powerModifier, 0);
    assert.equal(boardCard(match, `${owner}:diner-counter-test:144:vibe`)?.powerModifier, 0);
    assert.equal(openTab(match, receiptOwner, 1)?.spentRound, undefined,
      "an over-capacity move is rejected before its route can consume the receipt");
    assert.match(tabMark(match, receiptOwner, 1)!.text, /ready this round/);
  }
});

test("Construction play closures allow movement, while true story lane locks remain preflighted before Open Tab", () => {
  const constructionSnapshot: DistrictSnapshot = {
    version: 1,
    locations: [
      DISTRICT_CATALOG.find(location => location.id === "construction-site")!,
      DISTRICT_CATALOG.find(location => location.id === "bodega")!,
      DISTRICT_CATALOG.find(location => location.id === "the-trap")!,
    ],
  };
  const runtime = createMatch("block", "block", undefined, undefined, constructionSnapshot).districtRuntime!;
  const constructionMatch = () => ({
    ...freshMatch(),
    round: 4,
    districtSnapshot: constructionSnapshot,
    districtRuntime: runtime,
  });
  const decoy = (owner: Owner, index: number) =>
    character("hooper", owner, 2, index, { basePower: 30 });

  let moved = setBoard(constructionMatch(), decoy("player", 151));
  assert.deepEqual(getStoryLockedLanes(moved, "player"), [0], "Construction remains play-locked from round four");
  moved = play(moved, "bikelife", "player", 1, 152);
  assert.equal(boardCard(moved, "player:diner-counter-test:152:bikelife")?.lane, 0,
    "Bikelife may move into Construction despite the play-only closure");

  let receipt = play(constructionMatch(), "squabblehouse-cashier", "player", 1, 153);
  receipt = setBoard(receipt, ...receipt.boards.flat(), decoy("cpu", 154));
  receipt = play(receipt, "bikelife", "cpu", 1, 155);
  assert.equal(boardCard(receipt, "cpu:diner-counter-test:155:bikelife")?.lane, 1,
    "Open Tab intercepts the legal departure toward Construction");
  assert.equal(openTab(receipt, "player", 1)?.spentRound, 4);

  let locked = play(constructionMatch(), "squabblehouse-cashier", "player", 1, 156);
  locked = setBoard(locked, ...locked.boards.flat(), decoy("cpu", 157));
  locked = {
    ...locked,
    storyRuntime: {
      activePhaseIndex: -1,
      appliedEffectIds: [],
      lanePowerBonuses: [],
      laneLocks: [{ owner: "cpu", lanes: [0] }],
    },
  };
  locked = play(locked, "bikelife", "cpu", 1, 158);
  assert.equal(boardCard(locked, "cpu:diner-counter-test:158:bikelife")?.lane, 1,
    "an actual story lane lock still blocks movement");
  assert.equal(openTab(locked, "player", 1)?.spentRound, undefined,
    "an illegal route does not consume the receipt");
});

test("Open Tab blocks Bus Boy's enemy staff departure without its move reward", () => {
  let match = play(freshMatch(), "squabblehouse-cashier", "player", 0, 54);
  const passenger = character("squabblehouse-security", "cpu", 0, 55);
  match = setBoard(match, ...match.boards.flat(), passenger);
  match = play(match, "squabblehouse-bus-boy", "cpu", 0, 56);

  assert.equal(boardCard(match, passenger.instanceId)?.lane, 0);
  assert.equal(boardCard(match, passenger.instanceId)?.powerModifier, 0);
  assert.equal(boardCard(match, "cpu:diner-counter-test:56:squabblehouse-bus-boy")?.waveTrainingUsed, undefined);
  assert.equal(openTab(match)?.spentRound, 1);
});

test("Cashier echo refresh extends expiry without restoring the spent counter or phantom training", () => {
  let match = play(freshMatch(), "squabblehouse-cashier", "player", 0, 60);
  const firstCashier = boardCard(match, "player:diner-counter-test:60:squabblehouse-cashier")!;
  match = play(match, "squabblehouse-cashier", "player", 0, 61);
  const noOpCashier = boardCard(match, "player:diner-counter-test:61:squabblehouse-cashier")!;
  assert.equal(openTab(match)?.expiresAfterRound, 2);
  assert.equal(noOpCashier.waveTrainingUsed, undefined, "a same-round no-op refresh is not base success");

  match = play(match, "squabblehouse-teknician", "player", 0, 62);
  assert.equal(openTab(match)?.expiresAfterRound, 2);
  assert.equal(noOpCashier.waveTrainingUsed, undefined,
    "echoing an unneeded same-round refresh does not train the Cashier");
  assert.ok(firstCashier.waveTrainingUsed);

  match = play(match, "redside1", "cpu", 0, 63);
  assert.equal(openTab(match)?.spentRound, 1);
  match = endRound(match);
  assert.equal(match.round, 2);
  match = play(match, "redside1", "cpu", 0, 64);
  assert.equal(openTab(match)?.spentRound, 2);

  match = play(match, "squabblehouse-teknician", "player", 0, 65);
  const refreshed = openTab(match)!;
  assert.equal(refreshed.expiresAfterRound, 3, "a real extension succeeds through the next round");
  assert.equal(refreshed.spentRound, 2, "refresh does not reset a charge spent in the current round");
  assert.equal(refreshed.source.instanceId, noOpCashier.instanceId);
  assert.ok(boardCard(match, noOpCashier.instanceId)?.waveTrainingUsed,
    "the first genuine expiry extension is a base success");

  match = play(match, "redside1", "cpu", 0, 66);
  assert.equal(boardCard(match, "cpu:diner-counter-test:66:redside1")?.lane, 1,
    "a same-round second departure is not stopped after the counter was spent");
  assert.equal(openTab(match)?.spentRound, 2);
  match = endRound(match);
  assert.equal(match.round, 3);
  assert.match(tabMark(match)!.text, /ready this round · through R3/);
  match = endRound(match);
  assert.equal(match.round, 4);
  assert.equal(openTab(match), undefined, "the receipt expires after the end of its stored round");
  assert.equal(tabMark(match), undefined);
});

test("a later-round Cashier duplicate extends an already-spent receipt without recharging it", () => {
  let match = play(freshMatch(), "squabblehouse-cashier", "player", 0, 70);
  match = play(match, "redside1", "cpu", 0, 71);
  assert.equal(openTab(match)?.spentRound, 1);
  match = endRound(match);
  match = play(match, "redside1", "cpu", 0, 72);
  assert.equal(openTab(match)?.spentRound, 2);

  match = play(match, "squabblehouse-cashier", "player", 0, 73);
  assert.equal(match.round, 2);
  assert.equal(openTab(match)?.expiresAfterRound, 3);
  assert.equal(openTab(match)?.spentRound, 2);
  assert.match(tabMark(match)?.text ?? "", /spent this round · through R3/);
});

test("a same-round Cashier duplicate and Teknician echo do not train on an already-locked target or receipt", () => {
  let match = setBoard(freshMatchWithCashierLevel(8), character("techbro", "cpu", 0, 79));
  match = play(match, "squabblehouse-cashier", "player", 0, 80);
  const firstId = "player:diner-counter-test:80:squabblehouse-cashier";
  assert.equal(boardCard(match, firstId)?.powerModifier, 3);
  assert.equal(boardCard(match, "cpu:diner-counter-test:79:techbro")?.squabblehouseCannotMoveThroughRound, 2);
  assert.equal(openTab(match)?.expiresAfterRound, 2);

  match = play(match, "squabblehouse-cashier", "player", 0, 81);
  const duplicateId = "player:diner-counter-test:81:squabblehouse-cashier";
  assert.equal(boardCard(match, duplicateId)?.waveTrainingUsed, undefined);
  assert.equal(boardCard(match, duplicateId)?.powerModifier, 0,
    "an already-active lock and receipt are not a new base success");
  assert.equal(boardCard(match, "cpu:diner-counter-test:79:techbro")?.squabblehouseCannotMoveThroughRound, 2);
  assert.equal(openTab(match)?.expiresAfterRound, 2);
  assert.equal(openTab(match)?.source.instanceId, firstId);

  match = play(match, "squabblehouse-teknician", "player", 0, 82);
  assert.equal(boardCard(match, duplicateId)?.waveTrainingUsed, undefined,
    "echoing the no-op duplicate does not grant unlocked Cashier Hands either");
  assert.equal(boardCard(match, duplicateId)?.powerModifier, 0);
  assert.equal(openTab(match)?.expiresAfterRound, 2);
  assert.equal(openTab(match)?.source.instanceId, firstId);
});

test("Cashier training requires the Janitor-checked lock to survive alongside an armed receipt", () => {
  let match = play(freshMatchWithCashierLevel(8), "squabblehouse-cashier", "player", 0, 83);
  const firstId = "player:diner-counter-test:83:squabblehouse-cashier";
  assert.equal(boardCard(match, firstId)?.powerModifier, 3);
  assert.equal(openTab(match)?.expiresAfterRound, 2);

  match = setBoard(match, ...match.boards.flat(),
    character("hooper", "cpu", 0, 84), character("janitor", "cpu", 0, 85));
  match = play(match, "squabblehouse-cashier", "player", 0, 86);
  const duplicateId = "player:diner-counter-test:86:squabblehouse-cashier";
  const hooperId = "cpu:diner-counter-test:84:hooper";
  assert.equal(boardCard(match, hooperId)?.powerModifier, 2,
    "the committed Janitor reversal awards +2 Hands to the target");
  assert.equal(boardCard(match, hooperId)?.squabblehouseCannotMoveThroughRound, undefined,
    "the speculative lock is rolled back");
  assert.equal(boardCard(match, duplicateId)?.waveTrainingUsed, undefined,
    "a rolled-back lock plus an unextended receipt is not a base success");
  assert.equal(boardCard(match, duplicateId)?.powerModifier, 0,
    "the unlocked three-Hand training reward is not granted");
  assert.equal(openTab(match)?.expiresAfterRound, 2);
  assert.equal(openTab(match)?.source.instanceId, firstId);
});

test("Cashier receipt training is unchanged at zero and three unlocked upgrades", () => {
  for (const [level, expectedTrainingBonus] of [[1, 0], [8, 3]] as const) {
    let match = play(freshMatchWithCashierLevel(level), "squabblehouse-cashier", "player", 0, 67 + level);
    const cashierId = `player:diner-counter-test:${67 + level}:squabblehouse-cashier`;
    const trainedCashier = boardCard(match, cashierId)!;
    assert.equal(trainedCashier.waveTrainingUsed, true);
    assert.equal(trainedCashier.powerModifier, expectedTrainingBonus,
      `tier ${level === 1 ? 0 : 3} keeps its ordinary one-time training payoff`);

    match = play(match, "redside1", "cpu", 0, 77 + level);
    assert.equal(openTab(match)?.spentRound, 1);
    match = endRound(match);
    match = play(match, "redside1", "cpu", 0, 87 + level);
    assert.equal(openTab(match)?.spentRound, 2);

    match = play(match, "squabblehouse-teknician", "player", 0, 97 + level);
    assert.equal(openTab(match)?.expiresAfterRound, 3);
    assert.equal(openTab(match)?.spentRound, 2);
    assert.equal(boardCard(match, cashierId)?.powerModifier, expectedTrainingBonus,
      "refreshing through Teknician neither restores nor stacks the Cashier's training");
  }
});

test("receipt state is immutable, replay-safe, and present in online district marks", () => {
  const match = play(freshMatch(), "squabblehouse-cashier", "cpu", 0, 70);
  const initial = {
    ...match,
    phase: "player" as const,
    playerHand: [createCardInstance("redside1", "player", "diner-counter-test", 71)],
    playerMotion: 9,
  };
  const serialized = JSON.stringify(initial);
  const mover = initial.playerHand[0];
  const played = playTurnCard(initial, "player", mover.instanceId, 0, false);
  assert.equal(JSON.stringify(initial), serialized, "resolving a counter never mutates its input snapshot");

  const replayed = replayMatchPrefix(initial, [{
    cardInstanceId: mover.instanceId,
    lane: 0,
    squabble: false,
    endTurn: false,
  }]);
  assert.deepEqual(replayed.boards, played.boards);
  assert.deepEqual(replayed.districtTraps, played.districtTraps);
  assert.deepEqual(getCharacterDistrictMarks(replayed), getCharacterDistrictMarks(played));
  assert.equal(openTab(replayed, "cpu")?.spentRound, 1);

  const member = (userId: string, deck: (typeof decks)[number]) => ({
    userId,
    name: userId,
    ready: false,
    deck: { id: deck.id, name: deck.name, cards: [...deck.cards], hero: deck.hero },
  });
  let room = createOnlineRoom(member("counter-player", decks[0]), "player", 0);
  room = joinOnlineRoom(room, member("counter-cpu", decks[1]), 0);
  room = { ...room, status: "active", match: played };
  const view = onlineRoomView(room, "TEST", "counter-player", 1);
  assert.deepEqual(view.districtMarks, getCharacterDistrictMarks(played));
});

test("legacy matches without districtTraps can create and JSON-round-trip an Open Tab", () => {
  const legacy: Match = { ...freshMatch() };
  delete legacy.districtTraps;
  const placed = play(legacy, "squabblehouse-cashier", "player", 0, 79);
  const restored = JSON.parse(JSON.stringify(placed)) as Match;
  assert.equal(openTab(restored)?.expiresAfterRound, 2);
  assert.deepEqual(getCharacterDistrictMarks(restored), getCharacterDistrictMarks(placed));
});

test("Hot Off the Griddle keeps strongest-enemy targeting, breaks its Protection and adds the full attack", () => {
  const weakerProtected = character("hooper", "cpu", 0, 80, {
    powerModifier: 2,
    statuses: { ...createCardInstance("hooper", "cpu", "diner-counter-test", 80).statuses, protected: true, burnStacks: 2 },
  });
  const otherShielded = character("hooper", "cpu", 0, 79, {
    basePower: 1,
    statuses: { ...createCardInstance("hooper", "cpu", "diner-counter-test", 79).statuses, protected: true },
  });
  const strongerUnprotected = character("hooper", "cpu", 0, 81, { basePower: 20 });
  const source = createCardInstance("griddle-master", "player", "diner-counter-test", 82);
  const before = setBoard(freshMatch(), otherShielded, weakerProtected, strongerUnprotected);
  const withShield = {
    ...before,
    timedEffects: [{
      id: "target-shield",
      kind: "church-protection" as const,
      sourceInstanceId: "shield-source",
      targetInstanceId: weakerProtected.instanceId,
      owner: "cpu" as const,
      lane: 0 as const,
      startsAtRound: 1,
      expiresAtRound: 5,
      expiration: "round-start" as const,
    }, {
      id: "target-nail-mitigation",
      kind: "nail-mitigation" as const,
      sourceInstanceId: "salon-source",
      targetInstanceId: weakerProtected.instanceId,
      owner: "cpu" as const,
      lane: 0 as const,
      startsAtRound: 1,
      expiresAtRound: 3,
      expiration: "round-start" as const,
    }, {
      id: "other-ally-shield",
      kind: "salon-protection" as const,
      sourceInstanceId: "other-shield-source",
      targetInstanceId: otherShielded.instanceId,
      owner: "cpu" as const,
      lane: 0 as const,
      startsAtRound: 1,
      expiresAtRound: 3,
      expiration: "round-start" as const,
    }, {
      id: "target-is-wifey-guard",
      kind: "wifey-protection" as const,
      sourceInstanceId: weakerProtected.instanceId,
      owner: "cpu" as const,
      lane: 0 as const,
      startsAtRound: 1,
      expiresAtRound: 2,
      expiration: "round-start" as const,
    }, {
      id: "other-wifey-coverage",
      kind: "wifey-protection" as const,
      sourceInstanceId: "other-wifey",
      owner: "cpu" as const,
      lane: 0 as const,
      startsAtRound: 1,
      expiresAtRound: 2,
      expiration: "round-start" as const,
    }],
  };
  const match = play(withShield, "griddle-master", "player", 0, 82);
  const cracked = boardCard(match, strongerUnprotected.instanceId)!;
  assert.equal(cracked.powerModifier, -2, "the strongest target takes the full 2 damage");
  assert.equal(cracked.statuses.burnStacks, 1, "the original attack still applies Burn");
  assert.equal(boardCard(match, weakerProtected.instanceId)?.powerModifier, 2,
    "a weaker protected enemy is not prioritized over the strongest enemy");
  assert.equal(boardCard(match, weakerProtected.instanceId)?.statuses.protected, true);
  assert.equal(boardCard(match, weakerProtected.instanceId)?.statuses.burnStacks, 2);
  assert.equal(match.timedEffects.some(effect => effect.id === "target-shield"), true);
  assert.equal(match.timedEffects.some(effect => effect.id === "target-nail-mitigation"), true);
  assert.equal(match.timedEffects.some(effect => effect.id === "other-ally-shield"), true,
    "other allies' shields remain unaffected");
  assert.equal(match.timedEffects.some(effect => effect.id === "target-is-wifey-guard"), true,
    "a Wifey source's global coverage is not erased with target-only protection");
  assert.equal(match.timedEffects.some(effect => effect.id === "other-wifey-coverage"), true);
  assert.ok(boardCard(match, source.instanceId)?.waveTrainingUsed);

  const burning = character("hooper", "cpu", 0, 83, {
    powerModifier: 5,
    statuses: { ...createCardInstance("hooper", "cpu", "diner-counter-test", 83).statuses, protected: true, burnStacks: 1 },
  });
  const burningShield = {
    ...setBoard(freshMatch(), burning),
    timedEffects: [{
      id: "burning-target-shield",
      kind: "church-protection" as const,
      sourceInstanceId: "test-protection-source",
      targetInstanceId: burning.instanceId,
      owner: "cpu" as const,
      lane: 0 as const,
      startsAtRound: 1,
      expiresAtRound: 3,
      expiration: "round-start" as const,
    }],
  };
  const fallback = play(burningShield, "griddle-master", "player", 0, 84);
  assert.equal(boardCard(fallback, burning.instanceId)?.powerModifier, 1,
    "stripping Protection does not skip the full 4 damage");
  assert.equal(boardCard(fallback, burning.instanceId)?.statuses.protected, false);
  assert.equal(boardCard(fallback, burning.instanceId)?.statuses.burnStacks, 2);
  assert.equal(fallback.timedEffects.some(effect => effect.id === "burning-target-shield"), false);

  const immune = character("hooper", "cpu", 0, 85, {
    statuses: {
      ...createCardInstance("hooper", "cpu", "diner-counter-test", 85).statuses,
      protected: true,
      uncounterable: true,
    },
  });
  const blocked = play(setBoard(freshMatch(), immune), "griddle-master", "player", 0, 86);
  assert.equal(boardCard(blocked, immune.instanceId)?.powerModifier, 0);
  assert.equal(boardCard(blocked, immune.instanceId)?.statuses.protected, true);
  assert.equal(boardCard(blocked, "player:diner-counter-test:86:griddle-master")?.waveTrainingUsed, undefined);
  assert.equal(cards["griddle-master"].ability, "Hot Off the Griddle");

  const guardedTarget = character("hooper", "cpu", 0, 87, {
    powerModifier: 5,
    statuses: { ...createCardInstance("hooper", "cpu", "diner-counter-test", 87).statuses, protected: true },
  });
  const guard = character("wifey", "cpu", 0, 88, {
    statuses: { ...createCardInstance("wifey", "cpu", "diner-counter-test", 88).statuses, protected: true },
  });
  const guarded = play(setBoard(freshMatch(), guardedTarget, guard), "griddle-master", "player", 0, 89);
  assert.equal(boardCard(guarded, guardedTarget.instanceId)?.powerModifier, 5,
    "Hot Off the Griddle bypasses only the selected target's Protection, not a separate district guard");
  assert.equal(boardCard(guarded, guardedTarget.instanceId)?.statuses.protected, true);
  assert.equal(boardCard(guarded, "player:diner-counter-test:89:griddle-master")?.waveTrainingUsed, undefined);
});

test("Janitor reverses a hostile forced-move package once per owner, lane, and round", () => {
  const janitor = character("janitor", "cpu", 0, 90);
  const duplicate = character("janitor", "cpu", 0, 91);
  const target = character("squabblehouse-bus-boy", "cpu", 0, 92);
  const match = play(setBoard(freshMatch(), janitor, duplicate, target),
    "flyingmonkeys", "player", 0, 93);
  const protectedCharacter = boardCard(match, target.instanceId)!;
  assert.equal(protectedCharacter.lane, 0);
  assert.equal(protectedCharacter.powerModifier, 2,
    "duplicate Janitors share one +2 reversal rather than stacking");
  assert.equal(protectedCharacter.statuses.burnStacks, 0,
    "the movement package's Burn is rolled back too");
  assert.equal(boardCard(match, "player:diner-counter-test:93:flyingmonkeys")?.waveTrainingUsed, undefined,
    "stopped displacement is not a successful move for the attacker");
  assert.equal(match.janitorReversals?.filter(item =>
    item.owner === "cpu" && item.lane === 0 && item.round === 1).length, 1);
  assert.equal(match.janitorReversals?.[0]?.charge, "staff");
  assert.match(getCharacterDistrictMarks(match).find(mark =>
    mark.owner === "cpu" && mark.lane === 0)?.text ?? "", /harm ready · staff spent/);

  const nonStaff = character("cornball", "cpu", 0, 94);
  const noReversal = play(setBoard(freshMatch(), janitor, duplicate, nonStaff),
    "flyingmonkeys", "player", 0, 95);
  assert.notEqual(boardCard(noReversal, nonStaff.instanceId)?.lane, 0,
    "forced movement protection is the Squabblehouse staff extension; ordinary hostile Hands/status remain broad");
  assert.equal(boardCard(noReversal, nonStaff.instanceId)?.statuses.burnStacks, 1);
  assert.equal(noReversal.janitorReversals?.length ?? 0, 0);
});

test("Janitor's independent harm and staff charges resolve in either order for both owners", () => {
  for (const owner of ["player", "cpu"] as const) {
    const enemy = owner === "player" ? "cpu" : "player";
    const makeMatch = (offset: number) => {
      const janitor = character("janitor", owner, 0, offset, { powerModifier: 10 });
      const duplicate = character("janitor", owner, 0, offset + 1, { powerModifier: 10 });
      const staff = character("squabblehouse-bus-boy", owner, 0, offset + 2);
      return { janitor, duplicate, staff, match: setBoard(freshMatch(), janitor, duplicate, staff) };
    };

    const harmFirst = makeMatch(owner === "player" ? 110 : 120);
    let match = play(harmFirst.match, "griddle-master", enemy, 0, owner === "player" ? 113 : 123);
    assert.equal(boardCard(match, harmFirst.janitor.instanceId)?.powerModifier, 12,
      "the damaging attack is reversed and only one duplicate grants its +2");
    assert.equal(match.janitorReversals?.length, 1);
    assert.equal(match.janitorReversals?.[0]?.charge, "harm");
    match = play(match, "flyingmonkeys", enemy, 0, owner === "player" ? 114 : 124);
    assert.equal(boardCard(match, harmFirst.staff.instanceId)?.lane, 0,
      "the unused staff charge still reverses forced movement");
    assert.equal(boardCard(match, harmFirst.staff.instanceId)?.powerModifier, 2);
    assert.deepEqual(match.janitorReversals?.map(item => item.charge).sort(), ["harm", "staff"]);
    assert.deepEqual(
      JSON.parse(JSON.stringify(match.effectLog.at(-1)?.replay.after.janitorReversals))
        .map((item: { charge?: string }) => item.charge).sort(),
      ["harm", "staff"],
      "round replay preserves both typed, independently spent charges",
    );

    const staffFirst = makeMatch(owner === "player" ? 130 : 140);
    match = play(staffFirst.match, "flyingmonkeys", enemy, 0, owner === "player" ? 133 : 143);
    assert.equal(boardCard(match, staffFirst.staff.instanceId)?.lane, 0);
    assert.equal(match.janitorReversals?.length, 1);
    assert.equal(match.janitorReversals?.[0]?.charge, "staff");
    match = play(match, "griddle-master", enemy, 0, owner === "player" ? 134 : 144);
    assert.equal(boardCard(match, staffFirst.janitor.instanceId)?.powerModifier, 12);
    assert.equal(match.janitorReversals?.length, 2);
    assert.deepEqual(match.janitorReversals?.map(item => item.charge).sort(), ["harm", "staff"]);
    assert.match(getCharacterDistrictMarks(match).find(mark => mark.owner === owner && mark.lane === 0)?.text ?? "",
      /harm spent · staff spent/);
    const refreshed = endRound(match);
    assert.equal(refreshed.round, match.round + 1);
    assert.match(getCharacterDistrictMarks(refreshed).find(mark =>
      mark.owner === owner && mark.lane === 0)?.text ?? "", /harm ready · staff ready/);
  }
});

test("Janitor markers project each charge and treat untyped historical records as spent", () => {
  const janitor = character("janitor", "cpu", 0, 145);
  const target = character("squabblehouse-bus-boy", "cpu", 0, 146);
  const match = setBoard(freshMatch(), janitor, target);
  const tagged = {
    ...match,
    janitorReversals: [{
      owner: "cpu" as const,
      lane: 0 as const,
      round: 1,
      sourceInstanceId: janitor.instanceId,
      targetInstanceId: target.instanceId,
      charge: "harm" as const,
    }],
  };
  const projected = JSON.parse(JSON.stringify(tagged)) as typeof tagged;
  assert.equal(
    getCharacterDistrictMarks(projected).find(mark => mark.owner === "cpu" && mark.lane === 0)?.text,
    "Turn It Around · harm spent · staff ready",
  );
  const historical = {
    ...match,
    janitorReversals: [{
      owner: "cpu" as const,
      lane: 0 as const,
      round: 1,
      sourceInstanceId: janitor.instanceId,
      targetInstanceId: target.instanceId,
    }],
  };
  assert.equal(
    getCharacterDistrictMarks(historical).find(mark => mark.owner === "cpu" && mark.lane === 0)?.text,
    "Turn It Around · harm spent · staff spent",
    "legacy replay records without a charge safely project both triggers as spent",
  );
});

test("A damaging death spends Janitor's harm charge, not its staff-removal charge", () => {
  const janitor = character("janitor", "player", 0, 150, { powerModifier: -20 });
  const staff = character("squabblehouse-bus-boy", "player", 0, 151, {
    basePower: 20,
    powerModifier: -18,
    statuses: { ...createCardInstance("squabblehouse-bus-boy", "player", "diner-counter-test", 151).statuses,
      burnStacks: 1 },
  });
  const match = play(setBoard(freshMatch(), janitor, staff), "griddle-master", "cpu", 0, 152);
  assert.equal(boardCard(match, staff.instanceId)?.powerModifier, -16,
    "the damage package is undone and the attempted lethal hit grants +2 Hands");
  assert.equal(boardCard(match, staff.instanceId)?.lane, 0);
  assert.equal(boardCard(match, janitor.instanceId)?.powerModifier, -20,
    "a damaging death reversal does not also trigger the staff charge");
  assert.equal(match.janitorReversals?.length, 1);
  assert.equal(match.janitorReversals?.[0]?.charge, "harm");
  assert.match(getCharacterDistrictMarks(match).find(mark => mark.owner === "player" && mark.lane === 0)?.text ?? "",
    /harm spent · staff ready/);
});

test("Janitor reverses Queen execution without kill rewards, and friendly Alice returns remain voluntary", () => {
  const janitor = character("janitor", "player", 0, 100);
  const staff = character("squabblehouse-cashier", "player", 0, 101, { powerModifier: -2 });
  let match = play(setBoard(freshMatch(), janitor, staff), "queenofhearts", "cpu", 0, 102);
  assert.ok(boardCard(match, staff.instanceId));
  assert.equal(boardCard(match, staff.instanceId)?.powerModifier, 0);
  assert.equal(match.boards.flat().some(card => card.cardId === "cardguard"), false,
    "reversed execution cannot summon its Card Guard payoff");
  assert.equal(match.blueNextBonus?.player, undefined, "execution does not grant a destruction reward");
  assert.equal(boardCard(match, "cpu:diner-counter-test:102:queenofhearts")?.waveTrainingUsed, undefined);
  assert.equal(match.laneDamage?.length ?? 0, 0);

  const alice = character("alice", "cpu", 0, 103);
  const friendlyJanitor = character("janitor", "cpu", 0, 104);
  const rabbit = character("mrrabbit", "cpu", 0, 105);
  const cheshire = character("cheshire", "cpu", 0, 106);
  match = endRound(setBoard(freshMatch(), alice, friendlyJanitor, rabbit, cheshire));
  assert.ok(match.cpuHand.some(card => card.instanceId === alice.instanceId),
    "Janitor does not reverse an ally's voluntary round-end return");
  assert.equal(match.janitorReversals?.length ?? 0, 0);
  assert.equal(boardCard(match, rabbit.instanceId)?.powerModifier, 1);
  assert.ok(match.boards[0].some(card => card.cardId === "grin"));
});

test("Queen training follows the committed execution recipient, including dog redirects and Janitor reversals", () => {
  for (const owner of ["player", "cpu"] as const) {
    const enemy = owner === "player" ? "cpu" : "player";
    const queenIndex = owner === "player" ? 160 : 170;
    const dog = character("cane-corso-red", enemy, 0, queenIndex + 1, { powerModifier: 2 });
    const redOg = character("triple-og-red", enemy, 0, queenIndex + 2);
    const redirected = play(
      setBoard(freshMatchWithCardLevel("queenofhearts", 8, owner), dog, redOg),
      "queenofhearts", owner, 0, queenIndex,
    );
    const queenId = `${owner}:diner-counter-test:${queenIndex}:queenofhearts`;
    assert.equal(boardCard(redirected, redOg.instanceId)?.lane, 0, "the matching OG survives its dog's interception");
    assert.equal(boardCard(redirected, dog.instanceId), undefined, "the dog receives and dies to the execution");
    assert.ok(redirected.effectLog.some(event => event.note.includes("intercepted the complete hostile package")),
      "the execution path actually redirects through the matching dog");
    assert.ok(redirected.boards[0].some(card => card.cardId === "cardguard" && card.owner === owner),
      "a redirected successful execution keeps its Guard payoff");
    assert.equal(boardCard(redirected, queenId)?.waveTrainingUsed, true);
    assert.equal(boardCard(redirected, queenId)?.powerModifier, 3,
      "tier-three Queen training follows the committed intercepted execution for either owner");

    const staff = character("squabblehouse-cashier", enemy, 0, queenIndex + 3, { powerModifier: -1 });
    const janitor = character("janitor", enemy, 0, queenIndex + 4);
    const denied = play(
      setBoard(freshMatchWithCardLevel("queenofhearts", 8, owner), staff, janitor),
      "queenofhearts", owner, 0, queenIndex + 5,
    );
    const deniedQueenId = `${owner}:diner-counter-test:${queenIndex + 5}:queenofhearts`;
    assert.equal(boardCard(denied, staff.instanceId)?.powerModifier, 1,
      "Janitor restores the attempted staff execution and applies its +2 reversal");
    assert.ok(denied.janitorReversals?.some(item => item.targetInstanceId === staff.instanceId));
    assert.equal(boardCard(denied, deniedQueenId)?.waveTrainingUsed, undefined,
      "a Janitor-reversed execution grants no Queen training");
    assert.equal(denied.boards[0].some(card => card.cardId === "cardguard"), false,
      "the discarded execution cannot leave a Card Guard");
  }
});

test("Janitor keeps ordinary hostile Hands and status reversal available to all friendly cards", () => {
  const janitor = character("janitor", "player", 0, 108);
  const target = character("cornball", "player", 0, 109, { powerModifier: 10 });
  const weakener = character("redside4", "cpu", 0, 110);
  const statusReversed = play(setBoard(freshMatch(), janitor, target), "redside4", "cpu", 0, 111);
  assert.equal(boardCard(statusReversed, target.instanceId)?.statuses.weakened, false);
  assert.equal(boardCard(statusReversed, target.instanceId)?.powerModifier, 12);

  const boostedTarget = character("cornball", "player", 0, 112, { powerModifier: 10 });
  const handReversed = play(setBoard(freshMatch(), janitor, boostedTarget),
    "squabblehouse-security", "cpu", 0, 113);
  assert.equal(boardCard(handReversed, boostedTarget.instanceId)?.powerModifier, 12,
    "a hostile Hands reduction still reverses against a non-staff ally");
});

test("blocked Dorothy and Alice returns have no return-dependent rewards", () => {
  let match = play(freshMatch(), "squabblehouse-cashier", "player", 0, 110);
  const target = character("cornball", "cpu", 0, 111);
  const dorothy = createCardInstance("dorothy", "cpu", "diner-counter-test", 112);
  match = setBoard(match, ...match.boards.flat(), target);
  match = play(match, "dorothy", "cpu", 0, 112);
  assert.equal(boardCard(match, target.instanceId)?.lane, 0);
  assert.equal(match.cpuHand.some(card => card.instanceId === target.instanceId), false);
  assert.equal(boardCard(match, dorothy.instanceId)?.waveTrainingUsed, undefined);
  assert.equal(openTab(match)?.spentRound, 1);
  assert.equal(match.discountTokens.some(token => token.eligibility === "homecoming"), false);

  const alice = character("alice", "cpu", 0, 113);
  const cheshire = character("cheshire", "cpu", 0, 114);
  const rabbit = character("mrrabbit", "cpu", 0, 115);
  match = play(freshMatch(), "squabblehouse-cashier", "player", 0, 116);
  match = setBoard(match, alice, cheshire, rabbit);
  match = endRound(match);
  assert.ok(boardCard(match, alice.instanceId), "Open Tab leaves Alice on the board");
  assert.equal(boardCard(match, alice.instanceId)?.aliceReady, undefined);
  assert.equal(boardCard(match, alice.instanceId)?.waveOnce?.alice, undefined);
  assert.equal(boardCard(match, rabbit.instanceId)?.powerModifier, 0);
  assert.equal(match.boards[0].some(card => card.cardId === "grin"), false);
  assert.equal(openTab(match)?.spentRound, 1);
});

test("Open Tab stops Mad Hatter's enemy return before any return- or movement-dependent rewards", () => {
  let match = play(freshMatch(), "squabblehouse-cashier", "player", 0, 120);
  const guest = character("cornball", "cpu", 0, 121);
  const remote = character("hooper", "cpu", 1, 122, { powerModifier: 2 });
  match = setBoard(match, ...match.boards.flat(), guest, remote);
  match = play(match, "madhatter", "cpu", 0, 123);

  assert.equal(boardCard(match, guest.instanceId)?.lane, 0);
  assert.equal(match.cpuHand.some(card => card.instanceId === guest.instanceId), false);
  assert.equal(boardCard(match, remote.instanceId)?.lane, 1);
  assert.equal(boardCard(match, "cpu:diner-counter-test:123:madhatter")?.waveTrainingUsed, undefined);
  assert.equal(openTab(match)?.spentRound, 1);
});