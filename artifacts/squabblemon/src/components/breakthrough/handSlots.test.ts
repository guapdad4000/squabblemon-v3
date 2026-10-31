import { strict as assert } from "node:assert";
import { test } from "node:test";
import { handOccupants, reconcileHandSlots } from "./handSlots";
import {
  createGame,
  deploy,
  type FighterDefinition,
} from "@workspace/squabblemon-engine/breakthrough";

test("rapid plays leave the other held cards under the same pointer coordinates", () => {
  const first = reconcileHandSlots([], ["a", "b", "c", "d"]);
  const second = reconcileHandSlots(first, ["b", "c", "d"]);
  const third = reconcileHandSlots(second, ["c", "d"]);
  assert.deepEqual(second, [null, "b", "c", "d"]);
  assert.deepEqual(third, [null, null, "c", "d"]);
  assert.deepEqual(first, ["a", "b", "c", "d"]);
});
test("draws fill free slots and a hand-list reorder does not move held cards", () => {
  const slots = [null, "b", null, "d"];
  assert.deepEqual(reconcileHandSlots(slots, ["d", "new", "b"]), [
    "new",
    "b",
    null,
    "d",
  ]);
  assert.deepEqual(reconcileHandSlots(slots, ["d", "b", "new", "next"]), [
    "new",
    "b",
    "next",
    "d",
  ]);
});
test("an emptied or reset hand cannot keep stale or duplicate card identities", () => {
  assert.deepEqual(reconcileHandSlots(["a", "b", "c", "d"], []), [
    null,
    null,
    null,
    null,
  ]);
  assert.deepEqual(reconcileHandSlots(["a", "a", null, null], ["a", "b"]), [
    "a",
    "b",
    null,
    null,
  ]);
  assert.deepEqual(reconcileHandSlots([], ["x", "y"]), ["x", "y", null, null]);
});
test("back-to-back same-lane drops free both hand slots immediately", () => {
  const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
    id: `slot-${i}`,
    name: `Slot ${i}`,
    cost: 1,
    hands: 3,
    art: "",
    description: "No ability.",
    ability: "none",
  }));
  let s = createGame(roster);
  const ids = [...s.players.player.hand];
  const slots = reconcileHandSlots([], handOccupants(s.players.player));
  s = deploy(s, "player", ids[0], 0).state;
  s = deploy(s, "player", ids[1], 0).state;
  assert.deepEqual(reconcileHandSlots(slots, handOccupants(s.players.player)), [
    null,
    null,
    ids[2],
    ids[3],
  ]);
  assert.equal(s.units.length, 2);
  assert.equal(s.elapsedMs, 0);
});
