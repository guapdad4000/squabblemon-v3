import assert from "node:assert/strict";
import { PostgresBreakthroughRoomStore } from "../artifacts/api-server/src/lib/breakthroughRooms";
import {
  createGame,
  type FighterDefinition,
} from "../lib/squabblemon-engine/src/breakthrough";
import {
  createBreakthroughRoomForSimulation,
  commandBreakthroughRoom,
  tickBreakthroughRoom,
  replayBreakthroughRoomJournal,
} from "../lib/squabblemon-engine/src/breakthroughRoom";
export async function verify(
  pool: ConstructorParameters<typeof PostgresBreakthroughRoomStore>[0],
) {
  const store = new PostgresBreakthroughRoomStore(pool);
  const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
    id: `c${i}`,
    name: `C${i}`,
    cost: 1,
    hands: 3,
    ability: "none",
    description: "Test",
  }));
  const now = Date.now();
  const initial = createBreakthroughRoomForSimulation({
    roomId: "db-test",
    ownerFence: 1,
    members: { player: "a", opponent: "b" },
    serverTimeMs: now,
    expiresAtMs: now + 200000,
    game: createGame(roster, { seed: 123 }),
  });
  assert.equal(await store.create(initial), true);
  assert.equal(await store.create(initial), false);
  const mutation = commandBreakthroughRoom(
    initial,
    "a",
    {
      commandId: "one",
      sequence: 1,
      command: {
        kind: "deploy",
        cardId: initial.game.players.player.hand[0],
        lane: 0,
      },
    },
    now,
  );
  const input = {
    roomId: initial.roomId,
    expectedRevision: 0,
    ownerFence: 1,
    entries: [mutation.journal!],
    checkpoint: null,
    terminal: null,
  };
  const race = await Promise.all([store.append(input), store.append(input)]);
  assert.deepEqual(race.sort(), [false, true]);
  const saved = (await store.recover(initial.roomId))!;
  assert.deepEqual(
    replayBreakthroughRoomJournal(saved.checkpoint, saved.journal),
    mutation.checkpoint,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM breakthrough_room_journal",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(await store.acquire(initial.roomId), null);
  await pool.query(
    "UPDATE breakthrough_rooms SET lease_until=clock_timestamp()-interval '1 second'",
  );
  const acquisitions = await Promise.all([
    store.acquire(initial.roomId),
    store.acquire(initial.roomId),
  ]);
  const acquired = acquisitions.find(Boolean)!;
  assert.equal(acquisitions.filter(Boolean).length, 1);
  assert.equal(acquired.checkpoint.ownerFence, 2);
  assert.equal(await store.renew(initial.roomId, 1), null);
  assert((await store.renew(initial.roomId, 2))! > now);
  assert.equal(await store.append(input), false);
  const terminal = tickBreakthroughRoom(
    acquired.checkpoint,
    initial.expiresAtMs,
  );
  const commit = {
    roomId: initial.roomId,
    expectedRevision: acquired.checkpoint.revision,
    ownerFence: 2,
    entries: [terminal.journal!],
    checkpoint: terminal.checkpoint,
    terminal: terminal.terminal,
  };
  // Fault injection inside the same transaction proves journal/head/outbox roll back together.
  await pool.query(
    "CREATE FUNCTION reject_terminal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected outbox failure'; END $$; CREATE TRIGGER fail_outbox BEFORE INSERT ON breakthrough_room_outbox FOR EACH ROW EXECUTE FUNCTION reject_terminal()",
  );
  await assert.rejects(store.append(commit), /injected outbox failure/);
  assert.equal(
    (await store.recover(initial.roomId))!.checkpoint.revision,
    acquired.checkpoint.revision,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM breakthrough_room_journal",
      )
    ).rows[0].n,
    0,
  );
  await pool.query("DROP TRIGGER fail_outbox ON breakthrough_room_outbox");
  assert.equal(await store.append(commit), true);
  assert.equal(await store.append(commit), false);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM breakthrough_room_outbox",
      )
    ).rows[0].n,
    1,
  );
  assert.deepEqual(
    (await store.recover(initial.roomId))!.checkpoint,
    terminal.checkpoint,
  );
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks: [
          "unique creation",
          "independent-connection CAS race",
          "JSONB journal replay",
          "exclusive expired lease takeover",
          "stale fence rejection",
          "lease renewal",
          "atomic outbox rollback",
          "terminal deduplication",
          "checkpoint compaction",
        ],
        database: "fresh owned native PostgreSQL; no application accounts",
      },
      null,
      2,
    ),
  );
}
