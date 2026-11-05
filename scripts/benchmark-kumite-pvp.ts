/** Reproducible uncompressed application-payload benchmark; excludes TLS/WebSocket
 * framing, compression, network RTT and database execution time. */
import { serializeRoomCheckpointUpdate } from "../artifacts/api-server/src/lib/breakthroughRooms";
import { deflateRawSync } from 'node:zlib';
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
  // Advance visible motion over the minute, with normal lane queue spacing.
  travelMs: 120000,
  decks: { player: deck, opponent: deck },
});
const unitCount = Number(process.env.BT_BENCH_UNITS ?? 60);
for (let i = 0; i < unitCount; i++)
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
  newWire = 0,
  mailboxBytes = 0,
  mailboxRows = 0,
  maxFrameBytes = 0,
  rosterWriteBytes = 0,
  checkpointBytes = 0,
  journalBytes = 0,
  compactCheckpointBytes = 0;
const store: RoomJournalStore = {
  recover: async () => {
    loads++;
    return { checkpoint: structuredClone(base), journal: [] };
  },
  append: async (input) => {
    newBytes += bytes(input);
    newWrites++;
    journalBytes += bytes(input.entries);
    if (input.checkpoint) {
      checkpoints++;
      checkpointBytes += bytes(input.checkpoint);
      compactCheckpointBytes += Buffer.byteLength(
        serializeRoomCheckpointUpdate(input.checkpoint),
      );
      rosterWriteBytes += bytes(input.checkpoint.game.roster);
    }
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
const stressTemplate = projectBreakthroughRoom(base, "a");
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
  if (time % 200 === 0)
    for (const account of ["a", "b"]) {
      const view = await owner.view(account);
      assert.deepEqual(view, projectBreakthroughRoom(base, account));
      oldWire += bytes(view);
      // Production reauth closes each stream at 45 seconds, requiring another snapshot.
      if (time === 46000) previous[account] = null;
      const frame = encodeRoomStream(previous[account], view);
      const frameBytes = bytes(frame) + 8; // "data: " plus double newline
      newWire += frameBytes;
      mailboxBytes += Buffer.byteLength(deflateRawSync(Buffer.from(JSON.stringify({frame})),{level:1}).toString('base64'));
      mailboxRows++;
      maxFrameBytes = Math.max(maxFrameBytes, frameBytes);
      assert.deepEqual(applyRoomStream(previous[account], frame), view);
      previous[account] = view;
    }
}
await owner.close();
// Separate codec stress: change every unit on every frame, regardless of engine queue spacing.
// This is an artificial bandwidth stress case, not a prediction of normal combat or CPU capacity.
let churnBytes = 0;
const template = stressTemplate;
let churnPrevious: BreakthroughRoomView | null = null;
for (let frame = 0; frame < 300; frame++) {
  const next = structuredClone(template);
  next.revision = frame;
  next.units = next.units.map((unit, index) => ({
    ...unit,
    position: ((frame * 13 + index * 17) % 1000) / 1000,
    hands: 1 + (frame % 9),
    burnStacks: frame % 4,
  }));
  if (frame === 225) churnPrevious = null;
  const encoded = encodeRoomStream(churnPrevious, next);
  churnBytes += bytes(encoded) + 8;
  assert.deepEqual(applyRoomStream(churnPrevious, encoded), next);
  churnPrevious = next;
}
console.log(
  JSON.stringify(
    {
      workload: {
        seed: 20261102,
        seconds: 60,
        units: unitCount,
        travelMs: 120000,
        engineHz: 20,
        sendHz: 5,
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
        checkpointBytes,
        journalBytes,
        rosterWriteBytes,
        compactCheckpointBytes,
        postgresPayloadEstimateBytes:
          newBytes - checkpointBytes + compactCheckpointBytes,
        checkpointNetworkReductionPercent:
          100 * (1 - compactCheckpointBytes / checkpointBytes),
        finalCheckpointBytes: bytes(base),
        fullRosterBytes: bytes(base.game.roster),
        smallReceiptMembershipBytes: bytes({
          members: base.members,
          receipt: null,
        }),
        reductionPercent: 100 * (1 - newBytes / oldBytes),
      },
      ephemeralMailbox: {compressedBase64Bytes: mailboxBytes, rowsWrittenAndDeleted: mailboxRows, retentionSeconds:30, bytesPerPlayerMinute:mailboxBytes/2},
      wire: {
        baselineBytes: oldWire,
        maxFrameBytes,
        reauthSnapshotsIncluded: true,
        sseFramingIncluded: true,
        optimizedBytes: newWire,
        optimizedBytesPerPlayerMinute: newWire / 2,
        reductionPercent: 100 * (1 - newWire / oldWire),
      },
      artificialAllUnitsChangingBytesPerPlayerMinute: churnBytes,
      localHarnessMs: performance.now() - start,
      limitations:
        "Synthetic CPU and application payloads; mailbox compression is measured, but SQL framing, TLS, network RTT, provider billing, database latency and human behavior are not.",
    },
    null,
    2,
  ),
);
