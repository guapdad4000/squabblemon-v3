import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type {
  OnlineRoom,
  OnlineRoomView,
} from "@workspace/squabblemon-engine/multiplayer";
import {
  cardCatalog,
  ROOKIE_CORE_IDS,
} from "@workspace/squabblemon-engine/data";

test(
  "real online routes: authorization, join races, private views, retries, complete match, reconnect and rematch",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const { default: express } = await import("express");
    const {
      db,
      pool,
      playerProfilesTable,
      onlineRoomsTable,
      onlineCommandsTable,
    } = await import("@workspace/db");
    const { eq, inArray } = await import("drizzle-orm");
    const { default: router } = await import("../routes/multiplayer");
    const users = Array.from(
      { length: 4 },
      () => `online-test-${randomUUID()}`,
    );
    await db.insert(playerProfilesTable).values(
      users.map((id, index) => ({
        clerkUserId: id,
        displayName: `Rival ${index}`,
        onboardingStep: "complete",
        ownedCardIds: cardCatalog.map((c) => c.catalogId),
        savedDecks: [
          {
            id: "custom",
            name: "My real crew",
            heroCardId: "hooper",
            cardIds: [...ROOKIE_CORE_IDS],
          },
        ],
        cardProgression: { cornball: { xp: 2800, level: 8 } },
      })),
    );
    const app = express();
    app.use(express.json());
    // Auth is injected ONLY in this isolated test server, never in production routes.
    app.use((req, _res, next) => {
      const userId = req.header("x-test-user") || null;
      (req as unknown as { auth: unknown }).auth = Object.assign(
        () => ({
          userId,
          sessionId: userId ? "test" : null,
          tokenType: "session_token",
          isAuthenticated: !!userId,
        }),
        { [Symbol.for("@clerk/express.auth")]: true },
      );
      next();
    });
    app.use("/api", router);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/multiplayer`;
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db
        .delete(playerProfilesTable)
        .where(inArray(playerProfilesTable.clerkUserId, users));
      await pool.end();
    });
    const request = async (user: string, path = "", body?: unknown) => {
      const response = await fetch(origin + path, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", "x-test-user": user },
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      return {
        status: response.status,
        body: (await response.json()) as OnlineRoomView & {
          error?: string;
          rooms?: unknown[];
        },
      };
    };
    const action = (
      user: string,
      view: OnlineRoomView,
      command: object,
      id = randomUUID(),
    ) =>
      request(user, `/${view.code}/actions`, {
        requestId: id,
        expectedRevision: view.revision,
        command,
      });
    assert.equal((await request("")).status, 401);
    assert.equal(
      (
        await request(users[0], "", {
          deckId: "missing",
          requestId: randomUUID(),
        })
      ).status,
      400,
    );
    const createId = randomUUID();
    const created = await request(users[0], "", {
      deckId: "custom",
      requestId: createId,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const code = created.body.code;
    assert.equal(
      (await request(users[0], "", { deckId: "custom", requestId: createId }))
        .body.code,
      code,
    );
    assert.equal((await request(users[1], `/${code}`)).status, 404);
    assert.equal(
      (
        await request(users[1], `/${code}/actions`, {
          requestId: randomUUID(),
          expectedRevision: 0,
          command: { type: "ready" },
        })
      ).status,
      404,
    );
    assert.equal(
      (await request(users[1], `/${code}/join`, { deckId: "custom" })).status,
      200,
    );
    assert.equal(
      (await request(users[1], `/${code}/join`, { deckId: "custom" })).status,
      200,
      "join is safe to retry",
    );
    assert.equal(
      (await request(users[2], `/${code}/join`, { deckId: "custom" })).status,
      409,
    );
    let view = (await request(users[0], `/${code}`)).body;
    const readyA = await action(users[0], view, { type: "ready" });
    assert.equal(readyA.status, 200);
    const readyB = await action(users[1], readyA.body, { type: "ready" });
    assert.equal(readyB.status, 200);
    view = readyB.body;
    assert.equal(view.status, "active");
    const actor = () => (view.activeSeat === "player" ? users[0] : users[1]);
    const actorView = async () => (await request(actor(), `/${code}`)).body;
    view = await actorView();
    assert.equal(view.hand[0].power, 1, "trained card is normalized");
    for (const user of users.slice(0, 2)) {
      const response = (await request(user, `/${code}`)).body;
      assert(!JSON.stringify(response).includes('"replay"'));
      assert(!JSON.stringify(response).includes('"userId"'));
      assert(response.hand.every((c) => c.owner === response.seat));
    }
    const firstActor = actor(),
      cheap = view.hand[0];
    const envelope = {
      requestId: randomUUID(),
      expectedRevision: view.revision,
      command: {
        type: "play",
        instanceId: cheap.instanceId,
        lane: 0,
        squabble: true,
      },
    };
    const [play, duplicate] = await Promise.all([
      request(firstActor, `/${code}/actions`, envelope),
      request(firstActor, `/${code}/actions`, envelope),
    ]);
    assert.equal(play.status, 200, JSON.stringify(play.body));
    assert.equal(duplicate.status, 200, JSON.stringify(duplicate.body));
    assert.equal(play.body.revision, duplicate.body.revision);
    assert.equal(play.body.boards[0].length, 1);
    assert.equal(
      (
        await request(firstActor, `/${code}/actions`, {
          ...envelope,
          command: { type: "end-turn" },
        })
      ).status,
      409,
    );
    assert.equal(
      (await action(firstActor, view, { type: "end-turn" })).status,
      409,
      "stale revision rejected",
    );
    view = play.body;
    // Two distinct commands at the same revision cannot both advance a turn.
    const concurrent = await Promise.all([
      action(firstActor, view, { type: "end-turn" }),
      action(firstActor, view, { type: "end-turn" }),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    view = concurrent.find((r) => r.status === 200)!.body;
    let turns = 1;
    while (view.status === "active") {
      const user = actor();
      view = await actorView();
      if (turns === 1) {
        const played = await action(user, view, {
          type: "play",
          instanceId: view.hand[0].instanceId,
          lane: 1,
          squabble: true,
        });
        assert.equal(played.status, 200);
        view = played.body;
        assert.deepEqual(view.squabble, { player: true, cpu: true });
      }
      const ended = await action(user, view, { type: "end-turn" });
      assert.equal(ended.status, 200, JSON.stringify(ended.body));
      view = ended.body;
      turns++;
    }
    assert.equal(turns, 12);
    assert.equal(view.round, 6);
    assert.equal(view.reason, "districts");
    const finalA = (await request(users[0], `/${code}`)).body,
      finalB = (await request(users[1], `/${code}`)).body;
    assert.deepEqual(finalA.scores, finalB.scores);
    assert.equal(finalA.winner, finalB.winner);
    assert(finalA.revealedDecks);
    const rematchA = await action(users[0], finalA, { type: "rematch" });
    const rematchB = await action(users[1], rematchA.body, { type: "rematch" });
    assert.equal(rematchB.body.status, "waiting");
    assert.equal(rematchB.body.gameNumber, 2);
    const profiles = await db
      .select()
      .from(playerProfilesTable)
      .where(inArray(playerProfilesTable.clerkUserId, users));
    assert(
      profiles.every((p) => p.softCurrency === 0 && p.xp === 0),
      "friend matches do not farm account rewards",
    );
    const [storedRoom] = await db
      .select()
      .from(onlineRoomsTable)
      .where(eq(onlineRoomsTable.code, code));
    const audit = await db
      .select()
      .from(onlineCommandsTable)
      .where(eq(onlineCommandsTable.roomId, storedRoom.id));
    assert.equal(
      audit.filter((row) => row.requestId === envelope.requestId).length,
      1,
    );
    // A join race has exactly one winner.
    const raceRoom = (
      await request(users[0], "", { deckId: "custom", requestId: randomUUID() })
    ).body;
    const joins = await Promise.all(
      users
        .slice(2)
        .map((user) =>
          request(user, `/${raceRoom.code}/join`, { deckId: "custom" }),
        ),
    );
    assert.deepEqual(joins.map((r) => r.status).sort(), [200, 409]);
    // Persist a deadline in the past, then verify a late move cannot undo a timeout.
    let second = (await action(users[0], rematchB.body, { type: "ready" }))
      .body;
    second = (await action(users[1], second, { type: "ready" })).body;
    const [record] = await db
      .select()
      .from(onlineRoomsTable)
      .where(eq(onlineRoomsTable.code, code));
    const state = record.state as unknown as OnlineRoom;
    await db
      .update(onlineRoomsTable)
      .set({ state: { ...record.state, deadline: Date.now() - 1 } })
      .where(eq(onlineRoomsTable.id, record.id));
    assert.equal(
      (
        await action(
          state.activeSeat === "player" ? users[0] : users[1],
          second,
          { type: "end-turn" },
        )
      ).status,
      409,
    );
    assert.equal((await request(users[0], `/${code}`)).body.reason, "timeout");

    // Four more waiting rooms reach the cap; the completed match must not count.
    for (let n = 0; n < 4; n++) {
      assert.equal(
        (
          await request(users[0], "", {
            deckId: "custom",
            requestId: randomUUID(),
          })
        ).status,
        201,
      );
    }
    assert.equal(
      (
        await request(users[0], "", {
          deckId: "custom",
          requestId: randomUUID(),
        })
      ).status,
      429,
      "only waiting and active rooms count toward the cap",
    );
    assert.equal(
      (
        await action(
          users[0],
          (await request(users[0], `/${raceRoom.code}`)).body,
          { type: "surrender" },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(users[0], "", {
          deckId: "custom",
          requestId: randomUUID(),
        })
      ).status,
      201,
      "closing a waiting room frees a slot immediately",
    );
  },
);
