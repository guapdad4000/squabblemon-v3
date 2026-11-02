/** Reproducible uncompressed application-payload benchmark; excludes TLS/WebSocket
 * framing, compression, network RTT and database execution time. */
import { performance } from "node:perf_hooks";
import {
  createGame,
  type Unit,
} from "../lib/squabblemon-engine/src/breakthrough";
import { BREAKTHROUGH_ROSTER } from "../lib/squabblemon-engine/src/breakthroughCatalog";
import {
  createBreakthroughRoomForSimulation,
  tickBreakthroughRoom,
  projectBreakthroughRoom,
  type BreakthroughRoomView,
} from "../lib/squabblemon-engine/src/breakthroughRoom";
import {
  BreakthroughRoomOwnerForSimulation as BreakthroughRoomOwner,
  type RoomJournalStore,
} from "../lib/squabblemon-engine/src/breakthroughRoomOwner";
import {
  encodeRoomStream,
  applyRoomStream,
} from "../lib/squabblemon-engine/src/breakthroughRoomStream";
import assert from "node:assert/strict";
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v));
const deck = [
  "nabu",
  "enki",
  "utu",
  "ninhursag",
  "inanna",
  "yakub",
  "enlil",
  "ereshkigal",
  "caucus-mountaineer",
  "anu",
];
const game = createGame(BREAKTHROUGH_ROSTER, {
  seed: 20261102,
  travelMs: 1e9,
  decks: { player: deck, opponent: deck },
});
for (let i = 0; i < 60; i++)
  game.units.push({
    id: `bench-${i}`,
    cardId: "nabu",
    side: i % 2 ? "opponent" : "player",
    lane: i % 3,
    position: i % 2 ? 1 : 0,
    hands: 2,
    baseHands: 2,
    maxHands: 2,
    squabbled: false,
    nextEffectAt: 999999,
  } as Unit);
let base = createBreakthroughRoomForSimulation({
  roomId: "benchmark",
  ownerFence: 1,
  members: { player: "a", opponent: "b" },
  serverTimeMs: 1000,
  expiresAtMs: 200000,
  game,
});
let now = 1000,
  newBytes = 0,
  newWrites = 0,
  checkpoints = 0,
  loads = 0,
  oldBytes = 0,
  oldWire = 0,
  newWire = 0;
const store: RoomJournalStore = {
  recover: async () => {
    loads++;
    return { checkpoint: structuredClone(base), journal: [] };
  },
  append: async (input) => {
    newBytes += bytes(input);
    newWrites++;
    if (input.checkpoint) checkpoints++;
    return true;
  },
};
const owner = new BreakthroughRoomOwner({
  roomId: "benchmark",
  ownerFence: 1,
  store,
  now: () => now,
  leaseExpiresAt: () => 200000,
});
let previous: Record<string, BreakthroughRoomView | null> = {
  a: null,
  b: null,
};
await owner.view("a");
const start = performance.now();
for (let time = 1050; time <= 61000; time += 50) {
  now = time;
  const mutation = tickBreakthroughRoom(base, now);
  base = mutation.checkpoint;
  oldBytes += bytes({
    checkpoint: base,
    journal: mutation.journal,
    terminal: mutation.terminal,
  });
  await owner.tick();
  if (time % 100 === 0)
    for (const account of ["a", "b"]) {
      const view = await owner.view(account);
      assert.deepEqual(view, projectBreakthroughRoom(base, account));
      oldWire += bytes(view);
      const frame = encodeRoomStream(previous[account], view);
      newWire += bytes(frame);
      assert.deepEqual(applyRoomStream(previous[account], frame), view);
      previous[account] = view;
    }
}
await owner.close();
console.log(
  JSON.stringify(
    {
      workload: {
        seed: 20261102,
        seconds: 60,
        units: 60,
        engineHz: 20,
        sendHz: 10,
        seats: 2,
        catalog: 311,
      },
      database: {
        baselineWrites: 1200,
        optimizedWrites: newWrites,
        optimizedLoads: loads,
        optimizedCheckpoints: checkpoints,
        baselinePayloadBytes: oldBytes,
        optimizedPayloadBytes: newBytes,
        reductionPercent: 100 * (1 - newBytes / oldBytes),
      },
      wire: {
        baselineBytes: oldWire,
        optimizedBytes: newWire,
        optimizedBytesPerPlayerMinute: newWire / 2,
        reductionPercent: 100 * (1 - newWire / oldWire),
      },
      localHarnessMs: performance.now() - start,
      limitations:
        "Synthetic CPU execution and uncompressed application JSON only; no network RTT, compression, TLS, database latency or human player claim.",
    },
    null,
    2,
  ),
);
