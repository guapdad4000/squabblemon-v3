import { BreakthroughRoomOwner as PublicRoomOwner } from "./src/breakthroughRoomOwner";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createGame, type FighterDefinition } from "./src/breakthrough";
import {
  createBreakthroughRoomForSimulation,
  projectBreakthroughRoom,
  tickBreakthroughRoom,
  type BreakthroughRoomCheckpoint,
  type RoomJournalEntry,
} from "./src/breakthroughRoom";
import {
  BreakthroughRoomOwnerForSimulation as BreakthroughRoomOwner,
  type RoomJournalStore,
} from "./src/breakthroughRoomOwner";
import {
  encodeRoomStream,
  applyRoomStream,
} from "./src/breakthroughRoomStream";
const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
  id: `card-${i}`,
  name: `Card ${i}`,
  cost: 1,
  hands: 3,
  ability: "none",
  description: "Test",
}));
function room() {
  return createBreakthroughRoomForSimulation({
    roomId: "r",
    ownerFence: 1,
    members: { player: "a", opponent: "b" },
    serverTimeMs: 1000,
    expiresAtMs: 200000,
    game: createGame(roster, { seed: 1234, travelMs: 1e9 }),
  });
}
const clone = <T>(v: T): T => structuredClone(v);
/** Transaction model for unit tests; deployment adapter has separate database checks. */
class Store implements RoomJournalStore {
  checkpoint = room();
  journal: RoomJournalEntry[] = [];
  head = 0;
  reads = 0;
  writes = 0;
  checkpoints = 0;
  bytes = 0;
  fence = 1;
  failAfter = false;
  failBefore = false;
  terminals = new Set<string>();
  async recover() {
    this.reads++;
    return clone({ checkpoint: this.checkpoint, journal: this.journal });
  }
  async append(input: Parameters<RoomJournalStore["append"]>[0]) {
    if (this.failBefore) {
      this.failBefore = false;
      throw Error("disk unavailable");
    }
    if (input.expectedRevision !== this.head || input.ownerFence !== this.fence)
      return false;
    this.writes++;
    this.bytes += Buffer.byteLength(JSON.stringify(input));
    this.head = input.entries.at(-1)!.revision;
    this.journal.push(...clone(input.entries));
    if (input.checkpoint) {
      this.checkpoints++;
      this.checkpoint = clone(input.checkpoint);
      this.journal = [];
    }
    if (input.terminal) this.terminals.add(input.terminal.id);
    if (this.failAfter) {
      this.failAfter = false;
      throw Error("lost commit reply");
    }
    return true;
  }
}
function harness(store = new Store()) {
  let now = 1000,
    lease = 300000;
  const owner = () =>
    new BreakthroughRoomOwner({
      roomId: "r",
      ownerFence: 1,
      store,
      now: () => now,
      leaseExpiresAt: () => lease,
    });
  return {
    store,
    owner,
    setTime: (n: number) => {
      now = n;
    },
    expire: () => {
      lease = now;
    },
  };
}
const envelope = (cardId: string) => ({
  commandId: "one",
  sequence: 1,
  command: { kind: "deploy", cardId, lane: 0 },
});
test("owner caches one recovery, reads never tick/write, sub-tick polls produce no journals", async () => {
  const h = harness(),
    o = h.owner();
  await o.view("a");
  h.setTime(1025);
  for (let i = 0; i < 20; i++) {
    await o.view("a");
    await o.tick();
  }
  assert.equal(h.store.reads, 1);
  assert.equal(h.store.writes, 0);
  assert.equal((await o.view("a")).elapsedMs, 0);
  await assert.rejects(o.view("stranger"), { code: "unauthorized" });
});
test("20Hz authoritative ticks batch 20 journals per write and checkpoint each ten seconds", async () => {
  const h = harness(),
    o = h.owner();
  for (let now = 1050; now <= 11000; now += 50) {
    h.setTime(now);
    await o.tick();
  }
  assert.equal(h.store.reads, 1);
  assert.equal(h.store.writes, 10);
  assert.equal(h.store.checkpoints, 1);
  assert.equal(h.store.head, 200);
  assert.equal((await o.view("a")).elapsedMs, 10000);
  assert.deepEqual(await h.owner().view("a"), await o.view("a"));
});
test("commands flush pending ticks before acknowledgment and duplicate retries survive crash", async () => {
  const h = harness(),
    o = h.owner();
  const card = (await o.view("a")).hand[0];
  h.setTime(1050);
  await o.tick();
  assert.equal(h.store.writes, 0);
  const ack = await o.command("a", envelope(card));
  assert.equal(ack.accepted, true);
  assert.equal(h.store.writes, 1);
  const restored = h.owner();
  assert.deepEqual(await restored.command("a", envelope(card)), ack);
  assert.equal(h.store.writes, 1);
  assert.equal((await restored.view("a")).units.length, 1);
});
test("unknown commit outcome recovers and returns original receipt without a duplicate play", async () => {
  const h = harness(),
    o = h.owner();
  const card = (await o.view("a")).hand[0];
  h.store.failAfter = true;
  await assert.rejects(o.command("a", envelope(card)), /lost commit reply/);
  const ack = await o.command("a", envelope(card));
  assert.equal(ack.accepted, true);
  assert.equal(h.store.writes, 1);
  assert.equal((await o.view("a")).units.length, 1);
});
test("failed write never acknowledges and recovery retries the same identity exactly once", async () => {
  const h = harness(),
    o = h.owner();
  const card = (await o.view("a")).hand[0];
  h.store.failBefore = true;
  await assert.rejects(o.command("a", envelope(card)), /disk unavailable/);
  assert.equal(h.store.head, 0);
  assert.equal((await o.command("a", envelope(card))).accepted, true);
  assert.equal(h.store.head, 1);
});
test("lease expiration and changed fence prevent stale reads or commits", async () => {
  const h = harness(),
    o = h.owner();
  const card = (await o.view("a")).hand[0];
  h.store.fence = 2;
  await assert.rejects(o.command("a", envelope(card)), { code: "stale-owner" });
  assert.equal(h.store.writes, 0);
  h.expire();
  await assert.rejects(o.view("a"), { code: "stale-owner" });
});
test("lost unacknowledged ticks recompute identically and terminal commits immediately once", async () => {
  const h = harness(),
    o = h.owner();
  h.setTime(1250);
  await o.tick();
  assert.equal(h.store.writes, 0);
  const restored = h.owner();
  await restored.tick();
  assert.deepEqual(await restored.view("a"), await o.view("a"));
  h.setTime(200000);
  await restored.tick();
  assert.equal(h.store.terminals.size, 1);
  assert.equal(h.store.checkpoints, 1);
  await h.owner().tick();
  assert.equal(h.store.terminals.size, 1);
});
test("wire deltas reconstruct exact seat view, remove entities and clear optional overrides", () => {
  let r = room();
  const before = projectBreakthroughRoom(r, "a");
  r = tickBreakthroughRoom(r, 1050).checkpoint;
  let after = projectBreakthroughRoom(r, "a");
  let frame = encodeRoomStream(before, after);
  assert.deepEqual(applyRoomStream(before, frame), after);
  after = {
    ...after,
    revision: 2,
    hand: [],
    tablets: [{ side: "player", lane: 1 }],
    events: [{ id: 1, type: "ability", text: "TABLET" }],
  };
  frame = encodeRoomStream(before, after);
  assert.deepEqual(applyRoomStream(before, frame), after);
  assert.equal(
    encodeRoomStream(before, { ...after, side: "opponent" }).kind,
    "snapshot",
  );
  if (frame.kind === "delta")
    assert.throws(
      () => applyRoomStream({ ...before, revision: 99 }, frame),
      /fresh snapshot/,
    );
});
test("wire transmits only changed live fields and contains no opponent hand or private engine state", async () => {
  const h = harness(),
    o = h.owner();
  const initial = await o.view("a");
  await o.command("a", envelope(initial.hand[0]));
  const before = await o.view("a");
  h.setTime(1100);
  await o.tick();
  const after = await o.view("a");
  const frame = encodeRoomStream(before, after);
  assert.equal(frame.kind, "delta");
  assert.deepEqual(applyRoomStream(before, frame), after);
  const json = JSON.stringify(frame);
  for (const hidden of ["effectsRng", "roster", "members", "receipts", "queue"])
    assert(!json.includes(`"${hidden}"`));
  assert(
    Buffer.byteLength(json) < Buffer.byteLength(JSON.stringify(after)) * 0.7,
  );
});
test("entity deltas retain reordering, deletion and removal of optional art without stale fields", async () => {
  const h = harness(),
    o = h.owner();
  const card = (await o.view("a")).hand[0];
  await o.command("a", envelope(card));
  const before = await o.view("a");
  before.units = Array.from({ length: 20 }, (_, i) => ({
    ...before.units[0],
    id: `u${i}`,
    art: "/old.webp",
  }));
  const after = structuredClone(before);
  after.revision++;
  after.units = after.units.slice(1).reverse();
  delete after.units[0].art;
  after.units[1].hands++;
  const frame = encodeRoomStream(before, after);
  assert.equal(frame.kind, "delta");
  assert.deepEqual(applyRoomStream(before, frame), after);
});

test("approved public owner does not load a room before its first request", () => {
  const store = new Store();
  assert.doesNotThrow(() => new PublicRoomOwner({
    roomId:'r',ownerFence:1,store,now:()=>1000,leaseExpiresAt:()=>300000,
  }));
  assert.equal(store.reads, 0);
});

test("surrender is durably acknowledged once, terminal and replayable after owner restart", async () => {
  const h = harness(),
    owner = h.owner();
  const envelope = {
    commandId: "surrender-one",
    sequence: 1,
    command: { kind: "surrender" },
  };
  const ack = await owner.command("a", envelope);
  assert(ack.accepted);
  assert.equal((await owner.view("a")).winner, "opponent");
  assert.equal((await owner.view("b")).reason, "surrender");
  assert.equal(h.store.terminals.size, 1);
  assert.deepEqual(await h.owner().command("a", envelope), ack);
  assert.equal(h.store.terminals.size, 1);
});
