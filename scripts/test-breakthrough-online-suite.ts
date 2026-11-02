import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import {
  BreakthroughOnlineService,
  type BreakthroughRuntimeOptions,
} from "../artifacts/api-server/src/lib/breakthroughOnline";
import { breakthroughRouter } from "../artifacts/api-server/src/routes/breakthrough";
import {
  createBreakthroughRoomForSimulation,
  tickBreakthroughRoom,
  type BreakthroughRoomCheckpoint,
} from "../lib/squabblemon-engine/src/breakthroughRoom";
import { BreakthroughRoomOwnerForSimulation } from "../lib/squabblemon-engine/src/breakthroughRoomOwner";
import { createGame } from "../lib/squabblemon-engine/src/breakthrough";
import { buildBreakthroughRoster } from "../lib/squabblemon-engine/src/breakthroughCatalog";
import { BREAKTHROUGH_PROTOCOL } from "../lib/squabblemon-engine/src/breakthroughOnline";
import { applyRoomStream } from "../lib/squabblemon-engine/src/breakthroughRoomStream";
import { OnlineError } from "../lib/squabblemon-engine/src/multiplayer";
const require = createRequire(
  `${process.cwd()}/artifacts/api-server/package.json`,
);
const express = require("express");
export async function verifyOnline(pool: BreakthroughRuntimeOptions["pool"]) {
  const roster = buildBreakthroughRoster(),
    cards = roster
      .filter((c) => c.kind !== "token" && c.cost <= 3)
      .slice(0, 10)
      .map((c) => c.id);
  const errors: unknown[] = [];
  const options: BreakthroughRuntimeOptions = {
    pool,
    report: (e) => errors.push(e),
    member: async (_c, userId, deckId) => {
      if (deckId !== "owned")
        throw new OnlineError("Choose cards you own.", 403);
      return { userId, name: userId, avatarKey: cards[0], cards };
    },
  };
  const engine = {
    admit() {},
    create: createBreakthroughRoomForSimulation,
    owner: (
      o: ConstructorParameters<typeof BreakthroughRoomOwnerForSimulation>[0],
    ) => new BreakthroughRoomOwnerForSimulation(o),
    roster: () => roster,
  };
  let service = new BreakthroughOnlineService(options, engine);
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    breakthroughRouter(service, (req) =>
      req.header("x-test-user")
        ? { userId: req.header("x-test-user")!, expiresAt: Date.now() + 60000 }
        : null,
    ),
  );
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number },
    base = `http://127.0.0.1:${address.port}/api/breakthrough`;
  async function call(user: string, path = "", body?: unknown, expected = 200) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        "x-test-user": user,
        "x-breakthrough-protocol": BREAKTHROUGH_PROTOCOL,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  }
  const connections: AbortController[] = [];
  try {
    await call("", "", undefined, 401);
    await call(
      "a",
      "/search",
      { deckId: "unowned", requestId: randomUUID() },
      403,
    );
    assert.equal(
      (await fetch(base, { headers: { "x-test-user": "a" } })).status,
      409,
    );
    const aId = randomUUID(),
      bId = randomUUID();
    const [a, b] = await Promise.all([
      call("a", "/search", { deckId: "owned", requestId: aId }),
      call("b", "/search", { deckId: "owned", requestId: bId }),
    ]);
    const roomId = a.roomId ?? b.roomId;
    assert(roomId);
    assert.equal((await call("a")).search.roomId, roomId);
    assert.equal(
      (await call("a", "/cancel", { requestId: aId })).roomId,
      roomId,
      "pairing wins cancellation",
    );
    assert.equal(
      (await call("b", "/search", { deckId: "owned", requestId: bId })).roomId,
      roomId,
    );
    await call("b", "/search", { deckId: "other", requestId: bId }, 403);
    await call("stranger", `/${roomId}`, undefined, 403);
    const first = await call("a", `/${roomId}`);
    assert.equal(first.hand.length, 4);
    assert(!("queue" in first));
    assert(!("roster" in first));
    assert(!("hand" in first.players.opponent));
    const command = {
      commandId: randomUUID(),
      sequence: 1,
      command: { kind: "deploy", cardId: first.hand[0], lane: 0 },
    };
    const ack = await call("a", `/${roomId}/commands`, command);
    assert(ack.accepted);
    assert.deepEqual(await call("a", `/${roomId}/commands`, command), ack);
    await call(
      "a",
      `/${roomId}/commands`,
      { ...command, command: { ...command.command, lane: 1 } },
      409,
    );
    const control = new AbortController();
    connections.push(control);
    const stream = await fetch(base + `/${roomId}/stream`, {
      headers: {
        "x-test-user": "b",
        "x-breakthrough-protocol": BREAKTHROUGH_PROTOCOL,
      },
      signal: control.signal,
    });
    assert.equal(stream.status, 200);
    assert(stream.body);
    const reader = stream.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    async function frame() {
      while (!buffer.includes("\n\n")) {
        const next = await reader.read();
        assert(!next.done);
        buffer += decoder.decode(next.value, { stream: true });
      }
      const split = buffer.indexOf("\n\n"),
        part = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      return JSON.parse(part.slice(6));
    }
    const snapshot = await frame();
    assert.equal(snapshot.kind, "snapshot");
    assert.equal(
      snapshot.view.side,
      first.side === "player" ? "opponent" : "player",
    );
    await new Promise((r) => setTimeout(r, 120));
    await service.cycle();
    const delta = await frame(),
      reconstructed = applyRoomStream(snapshot.view, delta);
    assert(reconstructed.revision > snapshot.view.revision);
    assert.equal(reconstructed.units.length, 1);
    control.abort();
    await reader.cancel().catch(() => undefined);
    await service.stop();
    await pool.query(
      "UPDATE breakthrough_rooms SET lease_until=clock_timestamp()-interval '1 second' WHERE room_id=$1",
      [roomId],
    );
    service = new BreakthroughOnlineService(options, engine);
    assert.deepEqual(
      await service.command(roomId, "a", command),
      ack,
      "restart replays exact durable ack",
    );
    const recovered = await service.view(roomId, "b");
    assert.equal(recovered.units.length, 1);
    assert.equal(
      (
        await pool.query(
          "SELECT owner_fence FROM breakthrough_rooms WHERE room_id=$1",
          [roomId],
        )
      ).rows[0].owner_fence,
      "3",
    );
    const surrender = {
      commandId: randomUUID(),
      sequence: 1,
      command: { kind: "surrender" },
    };
    const surrendered = await service.command(roomId, "b", surrender);
    await service.cycle();
    await service.settle();
    assert.deepEqual(
      await service.command(roomId, "b", surrender),
      surrendered,
      "terminal retry survives owner disposal",
    );
    assert.equal((await service.receipt(roomId, "a"))?.exclusion, "incomplete");
    assert.equal(
      (await service.lobby("a")).search?.status,
      "complete",
      "reload retains completed result",
    );
    // Independent settlement workers, transaction rollback and anti-farming caps use seeded authoritative terminals.
    async function terminal(a: string, b: string) {
      const now = Date.now(),
        id = randomUUID();
      const initial = createBreakthroughRoomForSimulation({
        roomId: id,
        ownerFence: 1,
        members: { player: a, opponent: b },
        serverTimeMs: now - 40000,
        expiresAtMs: now + 1000,
        game: createGame(roster, {
          seed: 22,
          durationMs: 40000,
          decks: { player: cards, opponent: cards },
        }),
      });
      initial.game.metrics.player.deployments = 2;
      initial.game.metrics.opponent.deployments = 2;
      const end = tickBreakthroughRoom(initial, now).checkpoint;
      assert.equal(end.phase, "complete");
      await pool.query(
        `INSERT INTO breakthrough_rooms VALUES($1,1,clock_timestamp(),$2,$2,$3,to_timestamp($4/1000.0))`,
        [id, end.revision, JSON.stringify(end), end.expiresAtMs],
      );
      await pool.query(
        "INSERT INTO breakthrough_room_outbox(id,room_id,event) VALUES($1,$2,$3)",
        [end.terminal!.id, id, JSON.stringify(end.terminal)],
      );
      return id;
    }
    const settledId = await terminal("c", "d");
    await pool.query(`CREATE FUNCTION reject_bt_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$;
      CREATE TRIGGER reject_bt_receipt BEFORE INSERT ON breakthrough_receipts FOR EACH ROW EXECUTE FUNCTION reject_bt_receipt()`);
    await assert.rejects(service.settle(), /test rollback/);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM breakthrough_records WHERE user_id IN ('c','d')",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT settled_at FROM breakthrough_room_outbox WHERE room_id=$1",
          [settledId],
        )
      ).rows[0].settled_at,
      null,
    );
    await pool.query("DROP TRIGGER reject_bt_receipt ON breakthrough_receipts");
    await Promise.all([service.settle(), service.settle()]);
    const receipt = await service.receipt(settledId, "c");
    assert(receipt?.eligible);
    assert.equal(receipt.delta, 3);
    await service.settle();
    assert.deepEqual(await service.receipt(settledId, "c"), receipt);
    for (let i = 0; i < 3; i++) {
      await terminal("c", "d");
      await Promise.all([service.settle(), service.settle()]);
    }
    const capped = await pool.query(
      "SELECT receipt FROM breakthrough_receipts WHERE user_id='c' ORDER BY settled_at DESC LIMIT 1",
    );
    assert.equal(capped.rows[0].receipt.exclusion, "opponent-cap");
    assert.equal(
      (
        await pool.query(
          "SELECT trophies,draws FROM breakthrough_records WHERE user_id='c'",
        )
      ).rows[0].trophies,
      9,
    );
    for (let i = 0; i < 16; i++) {
      await terminal("c", `daily-${i}`);
      await service.settle();
    }
    const competing = await Promise.all([
      terminal("c", "daily-last-a"),
      terminal("c", "daily-last-b"),
    ]);
    await Promise.all([service.settle(), service.settle()]);
    const lastReceipts = await Promise.all(
      competing.map((id) => service.receipt(id, "c")),
    );
    assert.equal(
      lastReceipts.filter((r) => r?.eligible).length,
      1,
      "only one competing room can claim the final daily slot",
    );
    assert.equal(
      lastReceipts.filter((r) => r?.exclusion === "daily-cap").length,
      1,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          suite: "breakthrough-online-native-http",
          passed: true,
          checks: [
            "auth and protocol",
            "owned-deck admission",
            "atomic human pairing",
            "cancel race",
            "membership privacy",
            "durable command retry",
            "conflicting retry",
            "SSE snapshot and delta",
            "restart recovery",
            "independent settlement workers",
            "settlement rollback",
            "unique receipt",
            "opponent anti-farming cap",
            "concurrent daily cap",
            "surrender and completed-result recovery",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    for (const c of connections) c.abort();
    await service.stop();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
