import assert from "node:assert/strict";
import { test } from "node:test";
import { BreakthroughConnection } from "./breakthroughOnline";
import {
  createGame,
  type FighterDefinition,
} from "@workspace/squabblemon-engine/breakthrough";
import {
  createBreakthroughRoomForSimulation,
  commandBreakthroughRoom,
  projectBreakthroughRoom,
  type RoomCommandEnvelope,
} from "@workspace/squabblemon-engine/breakthroughRoom";
const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
  id: `test-${i}`,
  name: `Test ${i}`,
  art: "",
  cost: 0,
  hands: 3,
  ability: "none",
  description: "",
}));
const until = async (predicate: () => boolean) => {
  for (let i = 0; i < 100 && !predicate(); i++)
    await new Promise((r) => setTimeout(r, 5));
  assert(predicate(), "Expected asynchronous recovery to finish");
};
test("online journal retries the same command after a lost ack and remount; next play uses the acknowledged sequence", async (t) => {
  const storage = new Map<string, string>(),
    oldStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
  });
  t.after(() => {
    if (oldStorage)
      Object.defineProperty(globalThis, "sessionStorage", oldStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  });
  let room = createBreakthroughRoomForSimulation({
    roomId: "room",
    ownerFence: 1,
    members: { player: "a", opponent: "b" },
    serverTimeMs: 1000,
    expiresAtMs: 100000,
    game: createGame(roster),
  });
  const sent: RoomCommandEnvelope[] = [];
  let latest = projectBreakthroughRoom(room, "a");
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/stream"))
        return new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ kind: "snapshot", view: projectBreakthroughRoom(room, "a") })}\n\n`,
                ),
              );
              init?.signal?.addEventListener(
                "abort",
                () => {
                  try {
                    c.error(new DOMException("Stopped", "AbortError"));
                  } catch {}
                },
                { once: true },
              );
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      const command = JSON.parse(String(init?.body)) as RoomCommandEnvelope;
      sent.push(command);
      const result = commandBreakthroughRoom(room, "a", command, 1000);
      room = result.checkpoint;
      if (sent.length === 1) throw new TypeError("Lost response after commit");
      return Response.json(result.ack);
    },
  );
  let connection = new BreakthroughConnection(
      "a",
      "room",
      (v) => {
        latest = v;
      },
      () => {},
    ),
    running = connection.start();
  await until(() => latest.roomId === "room");
  await new Promise((r) => setTimeout(r, 10));
  await connection.command({ kind: "deploy", cardId: latest.hand[0], lane: 0 });
  assert.equal(room.game.units.length, 1);
  assert.equal(storage.size, 1);
  connection.stop();
  await running;
  connection = new BreakthroughConnection(
    "a",
    "room",
    (v) => {
      latest = v;
    },
    () => {},
  );
  running = connection.start();
  await until(() => sent.length === 2 && storage.size === 0);
  assert.deepEqual(sent[1], sent[0]);
  assert.equal(room.game.units.length, 1);
  await connection.command({ kind: "deploy", cardId: latest.hand[0], lane: 1 });
  assert.equal(sent[2].sequence, 2);
  assert.equal(room.game.units.length, 2);
  // Deliberately keep the stream at its old revision; acknowledged sequence still wins.
  await connection.command({ kind: "deploy", cardId: latest.hand[1], lane: 2 });
  assert.equal(sent[3].sequence, 3);
  assert.equal(room.game.units.length, 3);
  connection.stop();
  await running;
});

test("transient command failure backs off despite incoming frames; hidden tabs disconnect and resume", async (t) => {
  const storage = new Map<string, string>();
  const visibility = new EventTarget() as EventTarget & { hidden: boolean };
  visibility.hidden = false;
  for (const [key, value] of Object.entries({
    document: visibility,
    sessionStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() =>
      previous
        ? Object.defineProperty(globalThis, key, previous)
        : Reflect.deleteProperty(globalThis, key),
    );
  }
  const room = createBreakthroughRoomForSimulation({
    roomId: "bandwidth",
    ownerFence: 1,
    members: { player: "a", opponent: "b" },
    serverTimeMs: 1000,
    expiresAtMs: 100000,
    game: createGame(roster),
  });
  const view = projectBreakthroughRoom(room, "a");
  let streamCount = 0,
    aborted = 0,
    publications = 0;
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const sent: RoomCommandEnvelope[] = [];
  const frame = () =>
    new TextEncoder().encode(
      `data: ${JSON.stringify({ kind: "snapshot", view })}\n\n`,
    );
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/stream")) {
        streamCount++;
        return new Response(
          new ReadableStream({
            start(c) {
              streamController = c;
              c.enqueue(frame());
              init?.signal?.addEventListener(
                "abort",
                () => {
                  aborted++;
                  try {
                    c.error(new DOMException("Stopped", "AbortError"));
                  } catch {}
                },
                { once: true },
              );
            },
          }),
        );
      }
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ error: "Temporary outage" }, { status: 503 });
    },
  );
  const connection = new BreakthroughConnection(
    "a",
    "bandwidth",
    () => publications++,
    () => {},
  );
  const running = connection.start();
  t.after(async () => {
    connection.stop();
    await running;
  });
  await until(() => publications > 0);
  await connection.command({ kind: "deploy", cardId: view.hand[0], lane: 0 });
  for (let i = 0; i < 100; i++) streamController!.enqueue(frame());
  await until(() => publications === 101);
  assert.equal(
    sent.length,
    1,
    "100 frames must not cause 100 HTTP command retries",
  );
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(sent.length, 2, "one bounded retry after the first backoff");
  assert.deepEqual(sent[0], sent[1]);
  visibility.hidden = true;
  visibility.dispatchEvent(new Event("visibilitychange"));
  await until(() => aborted === 1);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(streamCount, 1, "no reconnects while hidden");
  assert.equal(publications, 101);
  visibility.hidden = false;
  visibility.dispatchEvent(new Event("visibilitychange"));
  await until(() => streamCount === 2 && publications === 102);
  connection.stop();
  await running;
  assert.equal(
    storage.size,
    1,
    "unconfirmed intent survives suspension and stop",
  );
});
