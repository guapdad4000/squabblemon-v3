import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { TimedFxEvent } from "./batch4Effects";
import {
  BASE_IMPACT_MS,
  DAMAGE_READ_MS,
  baseImpactEdge,
  baseImpacts,
  combatContacts,
  combatNumbers,
  damagedBaseSmoke,
} from "./combatPresentation";
import { BREAKTHROUGH_ROSTER } from "@workspace/squabblemon-engine/breakthroughCatalog";
import {
  advance,
  createGame,
  deploy,
} from "@workspace/squabblemon-engine/breakthrough";
const fx = (id: number, type: string, extras = {}): TimedFxEvent => ({
  id,
  type,
  side: "player",
  lane: 1,
  position: 0.4,
  born: 100,
  text: type,
  ...extras,
});

test("simultaneous trades keep both recipients and their exact damage", () => {
  const cues = combatNumbers(
    [
      fx(1, "collision-damage", { amount: 5, targetUnitId: "a" }),
      fx(2, "collision-damage", {
        amount: 7,
        side: "opponent",
        targetUnitId: "b",
      }),
      fx(3, "defeat", { targetUnitId: "b" }),
    ],
    100,
  );
  assert.deepEqual(
    cues.map((c) => c.text),
    ["−5", "−7"],
  );
  assert.notEqual(cues[0].left, cues[1].left);
  assert.deepEqual(
    cues.map((c) => c.ko),
    [false, true],
  );
});
test("burn markers label actual damage without duplicating numbers", () => {
  const cues = combatNumbers(
    [
      fx(1, "burn", { amount: 1 }),
      fx(2, "damage", { amount: 1 }),
      fx(3, "damage", { amount: 3, side: "opponent" }),
    ],
    100,
  );
  assert.deepEqual(
    cues.map((c) => c.text),
    ["−1", "−3"],
  );
  assert.deepEqual(
    cues.map((c) => c.burn),
    [true, false],
  );
});
test("real Roaster entrance damage stays a hit and timed Burn gets its own hit and number", () => {
  const roaster = BREAKTHROUGH_ROSTER.find(
    (card) => card.ability === "ratios-receipts",
  )!;
  const defender = BREAKTHROUGH_ROSTER.find(
    (card) => card.hands >= 5 && card.id !== roaster.id,
  )!;
  const deck = [
    roaster.id,
    defender.id,
    ...BREAKTHROUGH_ROSTER.filter(
      (card) => card.id !== roaster.id && card.id !== defender.id,
    )
      .slice(0, 8)
      .map((card) => card.id),
  ];
  let state = createGame(BREAKTHROUGH_ROSTER, {
    seed: 41,
    decks: { player: deck, opponent: deck },
  });
  state.players.player.hand = [roaster.id];
  state.players.player.motion = 9;
  state.players.opponent.hand = [defender.id];
  state.players.opponent.motion = 9;
  const enemy = deploy(state, "opponent", defender.id, 1);
  assert.equal(enemy.error, undefined);
  const result = deploy(enemy.state, "player", roaster.id, 1);
  assert.equal(result.error, undefined);
  const entrance = result.state;
  assert.ok(entrance.events.some((e) => e.type === "damage" && !e.damageKind));
  const next = advance(entrance, 2000);
  const ticks = next.events
    .filter((e) => e.type === "damage" && e.damageKind === "burn")
    .map((e) => ({ ...e, born: next.elapsedMs }));
  assert.equal(ticks.length, 1);
  assert.deepEqual(
    combatNumbers(ticks, next.elapsedMs).map((c) => [c.text, c.burn]),
    [["−1", true]],
  );
  assert.equal(combatContacts(ticks, next.elapsedMs).length, 1);
});
test("zero damage and zero healing do not invent impact amounts", () => {
  assert.equal(
    combatNumbers(
      [
        fx(1, "damage", { amount: 0 }),
        fx(2, "mend", { amount: 0 }),
        fx(3, "block"),
      ],
      100,
    ).length,
    0,
  );
});
test("same-recipient payouts remain separate and get separated vertically", () => {
  const cues = combatNumbers(
    [
      fx(1, "damage", { amount: 2 }),
      fx(2, "damage", { amount: 1 }),
      fx(3, "mend", { amount: 3 }),
    ],
    100,
  );
  assert.deepEqual(
    cues.map((c) => c.text),
    ["−2", "−1", "+3"],
  );
  assert.ok(
    cues[0].position < cues[1].position && cues[1].position < cues[2].position,
  );
});
test("contact art coalesces spatial duplicates while preserving separate contacts", () => {
  const events = [
    fx(1, "hit"),
    fx(2, "damage", { amount: 2 }),
    fx(3, "damage", { amount: 1, lane: 2 }),
    fx(4, "damage", { amount: 1, born: 250 }),
    fx(5, "collision-damage", { amount: 5 }),
  ];
  assert.deepEqual(
    combatContacts(events, 300).map((e) => e.id),
    [1, 3, 4],
  );
});
test("presentation expires exactly and never displays a future cue", () => {
  const event = fx(1, "damage", { amount: 2 });
  assert.equal(combatNumbers([event], 99).length, 0);
  assert.equal(combatNumbers([event], 100 + DAMAGE_READ_MS - 1).length, 1);
  assert.equal(combatNumbers([event], 100 + DAMAGE_READ_MS).length, 0);
  assert.equal(combatContacts([event], 720).length, 0);
});
test("simultaneous final breaches keep both base reactions and expire together", () => {
  const events = [
    fx(1, "breach"),
    fx(2, "breach", { side: "opponent", lane: 2 }),
  ];
  assert.equal(baseImpacts(events, 100).length, 2);
  assert.equal(baseImpactEdge(events[0].side), "top");
  assert.equal(baseImpactEdge(events[1].side), "bottom");
  assert.equal(baseImpacts(events, 100 + BASE_IMPACT_MS).length, 0);
});

test("base smoke persists after transient events disappear and ignores fighter damage", () => {
  const first = damagedBaseSmoke([], [fx(1, "damage"), fx(2, "breach")]);
  assert.deepEqual(
    first.map((event) => event.id),
    [2],
  );
  assert.deepEqual(damagedBaseSmoke(first, []), first);
  assert.deepEqual(damagedBaseSmoke(first, [fx(3, "breach")]), first);
});
test("each breached side and lane has one bounded smoke marker", () => {
  const incoming = Array.from({ length: 100 }, (_, id) =>
    fx(id, "breach", { lane: id % 3, side: id % 2 ? "player" : "opponent" }),
  );
  assert.equal(damagedBaseSmoke([], incoming).length, 6);
  assert.equal(damagedBaseSmoke([], []).length, 0);
});
test("combat number anchors stay inside the shared track near both base boundaries", () => {
  const events = [
    fx(1, "damage", { amount: 2, position: -0.1 }),
    ...Array.from({ length: 5 }, (_, id) =>
      fx(id + 2, "damage", { amount: 1, position: 0.95 }),
    ),
  ];
  const cues = combatNumbers(events, 100);
  assert.equal(cues[0].position, 0);
  assert.ok(cues.every((cue) => cue.position >= 0 && cue.position <= 0.96));
  assert.deepEqual(
    cues.slice(1).map((cue) => cue.position),
    [0.96, 0.96, 0.96, 0.96, 0.96],
  );
});
