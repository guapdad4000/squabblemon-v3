import assert from "node:assert/strict";
import test from "node:test";
import { cards, decks, cardCatalog, validateCardAbilityUpgrades } from "./data";
import {
  BLOCKBUSTERS,
  BLOCKBUSTER_CHARACTERS,
} from "../../../lib/squabblemon-engine/src/blockbusterWave";
import {
  createMatch,
  createMatchFromEngineCards,
  verifyMatchTranscript,
  createCardInstance,
  playTurnCard,
  nextRound,
  getMatchRoundLimit,
  getDistrictResults,
  replayMatchPrefix,
  pass,
  revealCpuTurn,
  type Match,
  type Lane,
  type Owner,
  type PlayerMove,
} from "./gameEngine";
import {
  createOnlineRoom,
  joinOnlineRoom,
  applyOnlineCommand,
  onlineRoomView,
} from "@workspace/squabblemon-engine/multiplayer";
const blank = (): Match => ({
  ...createMatch("block", "block"),
  round: 3,
  playerMotion: 9,
  cpuMotion: 9,
  boards: [[], [], []],
  playerHand: [],
  cpuHand: [],
});
const unit = (owner: Owner, lane: Lane, index = 0) => ({
  ...createCardInstance("bouncer", owner, "test", index),
  lane,
});
function cast(
  m: Match,
  id: string,
  lane: Lane = 0,
  choice = 0,
  owner: Owner = "player",
) {
  const c = createCardInstance(id, owner, "cast", m.nextEventSequence);
  return playTurnCard(
    {
      ...m,
      phase: owner === "player" ? "player" : "cpu-reveal",
      [owner === "player" ? "playerHand" : "cpuHand"]: [c],
    },
    owner,
    c.instanceId,
    lane,
    false,
    choice,
  );
}
const end = (m: Match) => nextRound({ ...m, phase: "resolved" });
test("202 distinct catalog entries include all 18 new fighters and 10 lane events", () => {
  assert.equal(cardCatalog.length, 202);
  assert.equal(BLOCKBUSTER_CHARACTERS.length, 18);
  assert.equal(BLOCKBUSTERS.length, 10);
  validateCardAbilityUpgrades();
  for (const [id] of BLOCKBUSTERS) {
    assert.equal(cards[id].kind, "blockbuster");
    assert.equal(cards[id].power, 0);
  }
});
for (const [id] of [...BLOCKBUSTER_CHARACTERS, ...BLOCKBUSTERS])
  for (const owner of ["player", "cpu"] as const)
    test(id + " is deterministic and immutable for " + owner, () => {
      const m = blank();
      m.boards = [
        [unit("player", 0), unit("cpu", 0)],
        [unit("player", 1, 1), unit("cpu", 1, 1)],
        [],
      ];
      const saved = structuredClone(m);
      assert.deepEqual(cast(m, id, 0, 0, owner), cast(m, id, 0, 0, owner));
      assert.deepEqual(m, saved);
    });
test("lane events leave no scoring body and cannot spend Squabble", () => {
  const m = cast(blank(), "the-concert");
  assert.deepEqual(m.boards, [[], [], []]);
  assert.deepEqual(
    getDistrictResults(m).map((x) => x.player),
    [0, 0, 0],
  );
  const c = createCardInstance("the-concert", "player");
  assert.throws(
    () =>
      playTurnCard(
        { ...blank(), playerHand: [c] },
        "player",
        c.instanceId,
        0,
        true,
      ),
    /SQUABBLE/,
  );
});
test("Shootout hits five distinct targets on both sides in the chosen lane only", () => {
  const m = blank();
  m.boards[0] = Array.from({ length: 6 }, (_, i) =>
    unit(i % 2 ? "cpu" : "player", 0, i),
  );
  m.boards[1] = [unit("cpu", 1, 10)];
  const a = cast(m, "the-shootout");
  assert.equal(a.boards[0].filter((c) => c.powerModifier === -1).length, 5);
  assert.equal(a.boards[1][0].powerModifier, 0);
});
test("Block Spin repeats prior reductions twice without recording its own repeats", () => {
  const m = blank();
  m.boards[0] = [unit("player", 0), unit("cpu", 0)];
  let a = cast(m, "the-concert", 0, 1);
  assert.equal(a.laneDamage?.length, 2);
  a = cast({ ...a, playerMotion: 9 }, "the-block-spin");
  assert.deepEqual(
    a.boards[0].map((c) => c.powerModifier),
    [-3, -3],
  );
  assert.equal(a.laneDamage?.length, 2);
  assert.equal(end(a).laneDamage?.length, 0);
});
test("Concert mode is validated and affects both crews", () => {
  const m = blank();
  m.boards[0] = [unit("player", 0), unit("cpu", 0)];
  assert.deepEqual(
    cast(m, "the-concert", 0, 0).boards[0].map((c) => c.powerModifier),
    [1, 1],
  );
  assert.deepEqual(
    cast(m, "the-concert", 0, 1).boards[0].map((c) => c.powerModifier),
    [-1, -1],
  );
  assert.throws(() => cast(m, "the-concert", 0, 2), /investment/);
});
test("Setup trades an ally and conserves its Hands without targeting the enemy", () => {
  const m = blank();
  m.boards[0] = [
    unit("player", 0),
    { ...unit("player", 0, 1), powerModifier: -2 },
    unit("cpu", 0),
  ];
  const a = cast(m, "the-setup");
  assert.equal(a.boards[0].length, 2);
  assert.equal(a.boards[0][0].powerModifier, 3);
  assert.equal(a.boards[0][1].powerModifier, 0);
});
test("Sideshow empties the lane and Kickback gathers both crews; locked cards stay", () => {
  const m = blank();
  const locked = unit("cpu", 0);
  locked.statuses.locked = true;
  m.boards[0] = [unit("player", 0), locked, unit("cpu", 0, 1)];
  let a = cast(m, "the-sideshow");
  assert.deepEqual(
    a.boards[0].map((c) => c.instanceId),
    [locked.instanceId],
  );
  a = cast({ ...a, playerMotion: 9 }, "the-kickback", 2);
  assert.equal(a.boards[2].length, 2);
  assert.equal(a.boards[0].length, 1);
});
test("Dice Game validates wagers, rolls 3 D6, takes the best two, and transfers Motion", () => {
  const m = { ...blank(), playerMotion: 5, cpuMotion: 5 };
  for (const n of [-1, 1.5, 4, NaN])
    assert.throws(() => cast(m, "the-dice-game", 0, n), /investment/);
  assert.throws(
    () => cast({ ...m, cpuMotion: 0 }, "the-dice-game"),
    /Both sides/,
  );
  const a = cast(m, "the-dice-game", 0, 3),
    d = a.diceResult!;
  assert.equal(d.wager, 3);
  for (const roll of [d.player, d.cpu]) {
    assert.equal(roll.length, 3);
    assert(roll.every((n) => Number.isInteger(n) && n >= 1 && n <= 6));
  }
  const score = (v: number[]) => v.reduce((n, x) => n + x, 0) - Math.min(...v);
  assert.equal(
    d.winner,
    score(d.player) === score(d.cpu)
      ? "draw"
      : score(d.player) > score(d.cpu)
        ? "player"
        : "cpu",
  );
  assert.equal(a.playerMotion + a.cpuMotion, 10);
  assert.deepEqual(a.boards, [[], [], []]);
});
test("After Party ends exactly at seven, survives replay frames, and never stacks", () => {
  let m = cast({ ...blank(), round: 6 }, "the-after-party");
  m = cast({ ...m, playerMotion: 9 }, "the-after-party");
  assert.equal(getMatchRoundLimit(m), 7);
  assert.equal(m.effectLog.at(-1)?.replay.after.afterParty, true);
  m = end(m);
  assert.equal(m.round, 7);
  assert.equal(m.phase, "player");
  m = end(m);
  assert.equal(m.phase, "complete");
});
test("Cookout serves two foods and a persistent plate with repeated Burn", () => {
  let m = blank();
  m.boards = ([0, 1, 2] as Lane[]).map((l) => [
    unit("player", l, l),
  ]) as Match["boards"];
  m = cast(m, "the-cookout");
  assert.equal(
    m.boards.flat().filter((c) => c.cardId === "soulfood").length,
    2,
  );
  const plate = m.boards.flat().find((c) => c.cardId === "burnt-plate")!;
  assert(plate.hazard);
  const victim = m.boards[plate.lane!].find((c) => c.cardId === "bouncer")!,
    power = victim.powerModifier;
  m = end(m);
  assert.equal(
    m.boards.flat().find((c) => c.instanceId === victim.instanceId)
      ?.powerModifier,
    power - 1,
  );
  m = end(m);
  assert.equal(
    m.boards.flat().find((c) => c.instanceId === victim.instanceId)
      ?.powerModifier,
    power - 2,
  );
  assert(m.boards.flat().some((c) => c.instanceId === plate.instanceId));
});
test("human PvP validates Dice Game and publishes only resolved public dice and round limit", () => {
  const member = (id: string) => ({
    userId: id,
    name: id,
    ready: false,
    deck: {
      id: "custom",
      name: "test",
      hero: "buddy",
      cards: [
        "the-dice-game",
        "the-after-party",
        "buddy",
        "folks",
        "hooper",
        "plug",
        "streamer",
        "gamer",
        "techbro",
        "wifey",
      ],
    },
  });
  let room = createOnlineRoom(member("a"), "player", 0);
  room = joinOnlineRoom(room, member("b"), 1);
  room = applyOnlineCommand(room, "player", { type: "ready" }, 2);
  room = applyOnlineCommand(room, "cpu", { type: "ready" }, 3);
  const source = createCardInstance("the-dice-game", "player");
  room = {
    ...room,
    match: {
      ...room.match!,
      playerHand: [source],
      playerMotion: 5,
      cpuMotion: 5,
    },
  };
  room = applyOnlineCommand(
    room,
    "player",
    {
      type: "play",
      instanceId: source.instanceId,
      lane: 0,
      squabble: false,
      investment: 2,
    },
    4,
  );
  const view = onlineRoomView(room, "TEST", "a", 5);
  assert.equal(view.diceResult?.wager, 2);
  assert(!("cpuHand" in view));
  assert.equal(view.roundLimit, 6);
});

test("a seven-round solo transcript replays identically through the reward verifier", () => {
  const ids = [
    "the-after-party",
    "the-dice-game",
    "buddy",
    "folks",
    "hooper",
    "plug",
    "streamer",
    "gamer",
    "techbro",
    "wifey",
  ];
  const initial = createMatchFromEngineCards(
    "custom",
    ids,
    "block",
    decks.find((d) => d.id === "block")!.cards,
  );
  const moves: PlayerMove[] = [];
  let m = initial;
  while (m.phase !== "complete") {
    const party = m.playerHand.find((c) => c.cardId === "the-after-party");
    if (party && m.playerMotion >= 3) {
      moves.push({
        cardInstanceId: party.instanceId,
        lane: 0,
        squabble: false,
        endTurn: false,
      });
      m = playTurnCard(m, "player", party.instanceId, 0);
    }
    const dice = m.playerHand.find((c) => c.cardId === "the-dice-game");
    if (dice && m.playerMotion >= 1 && m.cpuMotion >= 1) {
      moves.push({
        cardInstanceId: dice.instanceId,
        lane: 1,
        squabble: false,
        endTurn: false,
        investment: 1,
      });
      m = playTurnCard(m, "player", dice.instanceId, 1, false, 1);
    }
    moves.push({
      cardInstanceId: null,
      lane: null,
      squabble: false,
      endTurn: true,
    });
    m = nextRound(revealCpuTurn(pass(m, "player")));
  }
  assert.equal(m.round, 7);
  assert.deepEqual(replayMatchPrefix(initial, moves), m);
  assert.deepEqual(
    verifyMatchTranscript(
      "custom",
      "block",
      moves,
      initial.abilityUpgradeSnapshot,
      ids,
    ),
    m,
  );
});

test("damage blocked by Protection is not recorded for Block Spin", () => {
  const m = blank();
  const target = unit("cpu", 0);
  target.statuses.protected = true;
  m.timedEffects.push({
    id: "test-shield",
    kind: "church-protection",
    sourceInstanceId: target.instanceId,
    targetInstanceId: target.instanceId,
    owner: "cpu",
    lane: 0,
    startsAtRound: 1,
    expiresAtRound: 99,
    expiration: "match-complete",
  });
  m.boards[0] = [target];
  const a = cast(m, "the-shootout");
  assert.equal(a.boards[0][0].powerModifier, 0);
  assert.equal(a.laneDamage?.length ?? 0, 0);
  assert.equal(
    cast({ ...a, playerMotion: 9 }, "the-block-spin").boards[0][0]
      .powerModifier,
    0,
  );
});

test("Tattoo Artist and Lawyer grant a real consumable shield", () => {
  for (const id of ["tattoo-artist", "lawyer"]) {
    const m = blank();
    m.boards[0] = [unit("player", 0)];
    let a = cast(m, id),
      target = a.boards[0][0];
    assert(
      a.timedEffects.some(
        (e) =>
          e.targetInstanceId === target.instanceId &&
          e.kind === "church-protection",
      ),
    );
    a = cast(a, "the-shootout", 0, 0, "cpu");
    assert.equal(
      a.boards[0].find((c) => c.instanceId === target.instanceId)
        ?.powerModifier,
      target.powerModifier,
    );
    assert(
      !a.timedEffects.some(
        (e) =>
          e.targetInstanceId === target.instanceId &&
          e.kind === "church-protection",
      ),
    );
  }
});
