import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  createGame,
  deploy,
  entranceAvailable,
  type FighterDefinition,
} from "@workspace/squabblemon-engine/breakthrough";
import {
  PracticeInputClock,
  laneAtPoint,
  moveGesture,
  type DragGesture,
  type LaneBounds,
} from "./deploymentInput";

const roster = (cost = 0): FighterDefinition[] =>
  Array.from({ length: 10 }, (_, i) => ({
    id: `fighter-${i}`,
    name: `Fighter ${i}`,
    cost,
    hands: 4,
    art: "",
    description: "No ability.",
    ability: "none",
  }));
test("a release at the Motion threshold uses elapsed input time instead of the stale rendered balance", () => {
  const clock = new PracticeInputClock();
  clock.resume(0);
  let s = clock.advanceTo(createGame(roster(5)), 1950, false);
  const card = s.players.player.hand[0];
  assert.equal(s.players.player.motion, 4.975);
  assert.equal(deploy(s, "player", card, 0).error, "Not enough Motion");
  s = clock.advanceTo(s, 2000, false);
  const placed = deploy(s, "player", card, 0);
  assert.equal(placed.error, undefined);
  assert.equal(placed.state.players.player.motion, 0);
  assert.equal(placed.state.commands.at(-1)?.elapsedMs, 2000);
});
test("an occupied entrance remains available at every release", () => {
  const clock = new PracticeInputClock();
  clock.resume(0);
  let s = createGame(roster());
  s = deploy(s, "player", s.players.player.hand[0], 0).state;
  s = clock.advanceTo(s, 5450, false);
  assert.equal(entranceAvailable(s, "player", 0), true);
  s = clock.advanceTo(s, 5500, false);
  assert.equal(entranceAvailable(s, "player", 0), true);
  assert.equal(
    deploy(s, "player", s.players.player.hand[0], 0).error,
    undefined,
  );
});
test("consecutive different-lane commands never wait for preceding summon or ability events", () => {
  const clock = new PracticeInputClock();
  clock.resume(0);
  let s = createGame(roster());
  for (const [at, lane] of [
    [100, 0],
    [250, 1],
    [400, 2],
  ] as const) {
    s = clock.advanceTo(s, at, false);
    const result = deploy(s, "player", s.players.player.hand[0], lane);
    assert.equal(result.error, undefined);
    s = result.state;
  }
  assert.deepEqual(
    s.commands.map((command) => command.elapsedMs),
    [100, 250, 400],
  );
  assert.deepEqual(
    s.units.map((unit) => unit.lane),
    [0, 1, 2],
  );
  assert.equal(s.events.filter((event) => event.type === "deploy").length, 3);
});
test("input catch-up does not advance the following frame twice, including partial ticks", () => {
  const clock = new PracticeInputClock();
  clock.resume(0);
  let s = createGame(roster());
  s = clock.advanceTo(s, 125, false);
  assert.equal(s.elapsedMs, 100);
  assert.equal(s.accumulatorMs, 25);
  s = deploy(s, "player", s.players.player.hand[0], 0).state;
  s = clock.advanceTo(s, 200, false);
  assert.equal(s.elapsedMs, 200);
  assert.equal(s.accumulatorMs, 0);
  assert.equal(s.units[0].position, 0.004);
  assert.deepEqual(clock.advanceTo(s, 200, false), s);
});
test("the buzzer is resolved before accepting a late release", () => {
  const clock = new PracticeInputClock();
  clock.resume(0);
  let s = createGame(roster(), { durationMs: 500 });
  s = clock.advanceTo(s, 499, false);
  assert.equal(s.status, "playing");
  const card = s.players.player.hand[0];
  s = clock.advanceTo(s, 500, false);
  assert.equal(s.status, "complete");
  const result = deploy(s, "player", card, 0);
  assert.equal(result.error, "Match complete");
  assert.equal(result.state.commands.length, 0);
});
test("paused or hidden practice time is not retroactively charged on resume", () => {
  const clock = new PracticeInputClock();
  clock.resume(100);
  let s = clock.advanceTo(createGame(roster()), 250, false);
  clock.stop();
  assert.equal(clock.advanceTo(s, 10000, false), s);
  clock.resume(20000);
  s = clock.advanceTo(s, 20050, false);
  assert.equal(s.elapsedMs, 200);
});
test("a backward timestamp cannot rewind or later double-charge the simulation", () => {
  const clock = new PracticeInputClock();
  clock.resume(100);
  let s = clock.advanceTo(createGame(roster()), 200, false);
  s = clock.advanceTo(s, 150, false);
  assert.equal(s.elapsedMs, 100);
  s = clock.advanceTo(s, 250, false);
  assert.equal(s.elapsedMs, 150);
  assert.throws(() => clock.advanceTo(s, NaN, false));
});
test("the clock preserves AI decisions across frames and input catch-up", () => {
  const a = new PracticeInputClock(),
    b = new PracticeInputClock();
  a.resume(0);
  b.resume(0);
  let x = createGame(roster(1)),
    y = createGame(roster(1));
  for (let at = 100; at <= 2700; at += 100) x = a.advanceTo(x, at, true);
  y = b.advanceTo(y, 2700, true);
  assert.deepEqual(x, y);
  assert(x.commands.some((c) => c.side === "opponent"));
});

const lanes: LaneBounds[] = [0, 1, 2].map((lane) => ({
  lane: lane as 0 | 1 | 2,
  left: 30 + lane * 100,
  right: 130 + lane * 100,
  top: 80,
  bottom: 600,
}));
test("lane targeting uses release coordinates throughout the lane, independently of child artwork", () => {
  for (const lane of lanes)
    for (const y of [81, 220, 450, 599])
      assert.equal(
        laneAtPoint((lane.left + lane.right) / 2, y, lanes),
        lane.lane,
      );
  assert.equal(laneAtPoint(130, 300, lanes), 1); // Shared border belongs to one lane, never both.
});
test("header, hand, side gutters and off-screen releases cannot deploy", () => {
  for (const [x, y] of [
    [0, 300],
    [360, 300],
    [150, 79],
    [150, 600],
    [150, 760],
    [-1, -1],
  ])
    assert.equal(laneAtPoint(x, y, lanes), null);
  assert.equal(laneAtPoint(NaN, 200, lanes), null);
});
test("tap jitter stays a tap; crossing the threshold stays a drag even if the pointer comes back", () => {
  const start: DragGesture = {
    pointerId: 1,
    cardId: "fighter-0",
    squabble: true,
    startX: 10,
    startY: 10,
    threshold: 6,
    dragging: false,
  };
  assert.equal(moveGesture(start, 12, 12), start);
  const drag = moveGesture(start, 16, 10);
  assert.equal(drag.dragging, true);
  assert.equal(moveGesture(drag, 10, 10).dragging, true);
  assert.equal(drag.cardId, start.cardId);
  assert.equal(drag.squabble, true);
});
