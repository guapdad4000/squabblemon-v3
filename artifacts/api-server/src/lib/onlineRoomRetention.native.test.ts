import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { cardCatalog, catalogIdsToEngineIds, ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';

test('native replay retention: prunes only old settled replays and preserves room metadata', { skip: !process.env.DATABASE_URL }, async t => {
  assert.equal(process.env.ONLINE_RETIREMENT_TEST_OWNED, '1', 'Run the fresh owned native PostgreSQL harness.');
  const { db, pool, playerProfilesTable: profiles, onlineRoomsTable: rooms } = await import('@workspace/db');
  const { eq, inArray } = await import('drizzle-orm');
  const { pruneFinishedRoomReplays, REPLAY_RETENTION_MS } = await import('./onlineRoomRetention');
  const { accessFriendRoom } = await import('./onlineMatches');
  const { getSocialRecords } = await import('./socialRecords');
  const { storeOnlineRoom } = await import('./onlineRoomPersistence');
  const users: string[] = [];
  t.after(async () => { await db.delete(profiles).where(inArray(profiles.clerkUserId, users)); await pool.end(); });
  async function player() {
    const id = `retention-${randomUUID()}`; users.push(id);
    await db.insert(profiles).values({ clerkUserId: id, displayName: 'Retention test', onboardingStep: 'complete', ownedCardIds: cardCatalog.map(c => c.catalogId) });
    return id;
  }
  const member = (userId: string) => ({ userId, name: 'Retention test', ready: false,
    deck: { id: 'custom', name: 'Crew', hero: 'hooper', cards: catalogIdsToEngineIds([...ROOKIE_CORE_IDS]) } });
  const now = Date.now();
  const old = now - REPLAY_RETENTION_MS - 60_000;
  function finished(a: string, b: string, extra: Partial<OnlineRoom> = {}): OnlineRoom {
    let room = joinOnlineRoom(createOnlineRoom(member(a), 'player', now), member(b), now);
    room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
    room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
    room = applyOnlineCommand(room, 'player', { type: 'surrender' }, now);
    assert.equal(room.status, 'complete'); assert(room.match);
    return { ...room, ...extra };
  }
  async function store(room: OnlineRoom, expiresAt: number) {
    const [row] = await db.insert(rooms).values({ code: randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
      hostUserId: room.members.player.userId, guestUserId: room.members.cpu?.userId ?? null,
      createRequestId: randomUUID(), state: storeOnlineRoom(room), expiresAt: new Date(expiresAt) }).returning();
    return row;
  }
  const read = async (id: string) => (await db.select().from(rooms).where(eq(rooms.id, id)))[0];
  const a = await player(), b = await player();
  const ratings = { player: 1000, cpu: 1000 };
  const settled = { queuedAt: now, heartbeatAt: now, botAfter: now, bot: false, ratings,
    settlement: { player: { before: 1000, after: 1010 }, cpu: { before: 1000, after: 990 } } } as unknown as OnlineRoom['ranked'];
  const friendly = await store(finished(a, b), old);
  const ranked = await store(finished(a, b, { ranked: settled }), old);
  const unsettled = await store(finished(a, b, { ranked: { ...settled!, settlement: undefined } }), old);
  const kumite = await store(finished(a, b, { kumite: { tournamentId: randomUUID(), matchId: randomUUID(), roundDeadline: now, finishedAt: now } as OnlineRoom['kumite'] }), old);
  const recent = await store(finished(a, b), now - 60_000);
  const lockedRoom = await store(finished(a, b), old);
  let active = joinOnlineRoom(createOnlineRoom(member(a), 'player', now), member(b), now);
  active = applyOnlineCommand(applyOnlineCommand(active, 'player', { type: 'ready' }, now), 'cpu', { type: 'ready' }, now);
  const activeRow = await store(active, old);
  const before = await getSocialRecords(a);
  const originals = new Map((await db.select().from(rooms).where(inArray(rooms.hostUserId, [a]))).map(row => [row.id, row]));

  const owner = await pool.connect();
  try {
    await owner.query('begin');
    await owner.query('select id from online_rooms where id = $1 for update', [lockedRoom.id]);
    const first = await pruneFinishedRoomReplays({ now, batchSize: 1, maxBatches: 10 });
    assert.equal(first.pruned, 2, 'friendly and settled ranked rooms are pruned one batch at a time');
    assert(first.batches >= 2);
  } finally { await owner.query('rollback'); owner.release(); }

  for (const row of [friendly, ranked]) {
    const after = await read(row.id);
    const original = originals.get(row.id)!;
    assert.equal(after.state.match, null);
    assert.equal(after.state.replayPrunedAt, now);
    const { match: _a, replayPrunedAt: _b, ...rest } = after.state;
    const { match: _c, ...originalRest } = original.state;
    assert.deepEqual(rest, originalRest, 'all non-replay metadata is preserved');
    assert.deepEqual([after.code, after.hostUserId, after.guestUserId, after.expiresAt.getTime()],
      [original.code, original.hostUserId, original.guestUserId, original.expiresAt.getTime()]);
    assert.equal(after.liveState?.match, undefined);
    assert.notEqual(after.syncToken, original.syncToken, 'trigger refreshed the poll token');
  }
  for (const row of [unsettled, kumite, recent, lockedRoom, activeRow])
    assert.deepEqual((await read(row.id)).state, originals.get(row.id)!.state, 'ineligible or locked rooms are untouched');

  assert.deepEqual(await getSocialRecords(a), before, 'fade records are computed from retained metadata');
  const view = await accessFriendRoom(friendly.code, b);
  assert.equal(view.status, 'complete'); assert.equal(view.seat, 'cpu'); assert.deepEqual(view.hand, []);
  await assert.rejects(accessFriendRoom(friendly.code, await player()), /participant|not found/i);
  const rematch = await accessFriendRoom(friendly.code, a, { kind: 'command', requestId: randomUUID(), expectedRevision: view.revision, command: { type: 'rematch' } });
  assert.equal(rematch.status, 'complete');

  const second = await pruneFinishedRoomReplays({ now, batchSize: 1, maxBatches: 10 });
  assert.equal(second.pruned, 1, 'the previously locked room is pruned on the next run');
  assert.equal((await pruneFinishedRoomReplays({ now })).pruned, 0, 'idempotent');
});
