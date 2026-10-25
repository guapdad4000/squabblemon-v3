import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, ONLINE_RULES_VERSION, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { cardCatalog, catalogIdsToEngineIds, ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';

test('native live polling: archive isolation, same-revision invalidation and compact rollout', { skip: !process.env.DATABASE_URL }, async t => {
  assert.equal(process.env.ONLINE_RETIREMENT_TEST_OWNED, '1', 'Use the fresh owned PostgreSQL retirement harness');
  const { db, pool, onlineRoomsTable: rooms, playerProfilesTable: profiles } = await import('@workspace/db');
  const { eq, inArray } = await import('drizzle-orm');
  const { accessFriendRoom, pollFriendRoom, accessRoomReactions } = await import('./onlineMatches');
  const { storeOnlineRoom, restoreOnlineRoom } = await import('./onlineRoomPersistence');
  const users: string[] = [];
  const originalGate = process.env.ONLINE_COMPACT_REPLAY;
  t.after(async () => {
    if (originalGate === undefined) delete process.env.ONLINE_COMPACT_REPLAY; else process.env.ONLINE_COMPACT_REPLAY = originalGate;
    await db.delete(profiles).where(inArray(profiles.clerkUserId, users));
  });
  async function user() {
    const id = `poll-${randomUUID()}`; users.push(id);
    await db.insert(profiles).values({ clerkUserId: id, displayName: 'Poll test', onboardingStep: 'complete', ownedCardIds: cardCatalog.map(c => c.catalogId) });
    return id;
  }
  const a = await user(), b = await user(), outsider = await user();
  const member = (userId: string) => ({ userId, name: 'Poll test', ready: false,
    deck: { id: 'custom', name: 'Crew', hero: 'hooper', cards: catalogIdsToEngineIds([...ROOKIE_CORE_IDS]) } });
  for (const gate of ['0', '1']) await t.test(`compact writes ${gate}`, async () => {
    process.env.ONLINE_COMPACT_REPLAY = gate;
    const now = Date.now();
    let room = joinOnlineRoom(createOnlineRoom(member(a), 'player', now), member(b), now);
    room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
    room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
    assert.equal(room.status, 'active');
    const code = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const [row] = await db.insert(rooms).values({ code, hostUserId: a, guestUserId: b,
      createRequestId: randomUUID(), state: storeOnlineRoom(room), expiresAt: new Date(room.expiresAt) }).returning();
    assert.equal('replayArchive' in (row.state.match as object), gate === '1');
    assert.deepEqual(JSON.parse(JSON.stringify(restoreOnlineRoom(row.state))), JSON.parse(JSON.stringify(room)));
    assert.equal('match' in row.liveState!, false);
    const view = await accessFriendRoom(code, a);
    assert.match(view.syncToken!, /^[a-f0-9]{32}$/);
    const owner = await pool.connect();
    try {
      await owner.query('begin'); await owner.query('select id from online_rooms where id=$1 for update', [row.id]);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('live polling blocked on archive row lock')), 1200); });
        const response = await Promise.race([pollFriendRoom(code, a, view.syncToken), timeout]);
        assert.equal('unchanged' in response && response.unchanged, true);
        const reactions = await Promise.race([accessRoomReactions(code, a), timeout]);
        assert(Array.isArray(reactions.owned));
      } finally { clearTimeout(timer); }
    } finally { await owner.query('rollback'); owner.release(); }
    await assert.rejects(pollFriendRoom(code, outsider, view.syncToken), /participant|not found/i);
    // Every writer, including raw/older SQL writers, invalidates same-revision content.
    room = { ...room, members: { ...room.members, cpu: { ...room.members.cpu!, name: 'Corrected same revision' } } };
    await db.update(rooms).set({ state: storeOnlineRoom(room) }).where(eq(rooms.id, row.id));
    const corrected = await pollFriendRoom(code, a, view.syncToken);
    assert(!('unchanged' in corrected));
    assert.equal(corrected.revision, view.revision);
    assert.notEqual(corrected.syncToken, view.syncToken);
    assert.equal(corrected.members.cpu?.name, 'Corrected same revision');
    const legacy = await pollFriendRoom(code, b);
    assert(!('unchanged' in legacy)); assert.equal(legacy.seat, 'cpu');
    const reaction = (await accessRoomReactions(code, a)).owned[0];
    assert(reaction);
    await accessRoomReactions(code, a, { requestId: randomUUID(), reactionId: reaction, gameNumber: room.gameNumber });
    const reactionUpdated = await pollFriendRoom(code, a, corrected.syncToken);
    assert(!('unchanged' in reactionUpdated));
    assert.equal(reactionUpdated.revision, corrected.revision);
    assert.notEqual(reactionUpdated.syncToken, corrected.syncToken);
    const action = { kind: 'command' as const, requestId: randomUUID(), expectedRevision: room.revision, command: { type: 'surrender' as const } };
    const [first, retry] = await Promise.all([accessFriendRoom(code, a, action), accessFriendRoom(code, a, action)]);
    assert.equal(first.status, 'complete'); assert.equal(retry.revision, first.revision);
    const [finished] = await db.select().from(rooms).where(eq(rooms.id, row.id));
    assert.equal(restoreOnlineRoom(finished.state).status, 'complete');
    assert.equal('replayArchive' in (finished.state.match as object), gate === '1');
    // Turning compact writes off expands any subsequently written room, proving
    // mixed-format readers and the first stage of a rollback use full snapshots.
    if (gate === '1') {
      process.env.ONLINE_COMPACT_REPLAY = '0';
      await accessFriendRoom(code, a, { kind: 'command', requestId: randomUUID(), expectedRevision: first.revision, command: { type: 'lobby' } });
      const [expanded] = await db.select().from(rooms).where(eq(rooms.id, row.id));
      assert(!expanded.state.match || !('replayArchive' in (expanded.state.match as object)));
      process.env.ONLINE_COMPACT_REPLAY = gate;
    }
    // Due clocks and bot rooms must take the authoritative path even if the
    // caller supplies the exact persisted token.
    room = { ...room, deadline: Date.now() - 1 };
    await db.update(rooms).set({ state: storeOnlineRoom(room) }).where(eq(rooms.id, row.id));
    const [due] = await db.select({ token: rooms.syncToken }).from(rooms).where(eq(rooms.id, row.id));
    const expired = await pollFriendRoom(code, a, due.token!);
    assert(!('unchanged' in expired)); assert.equal(expired.reason, 'timeout');
    room = { ...room, deadline: Date.now() + 100_000, ranked: { queuedAt: now, heartbeatAt: now, botAfter: now, bot: true, botNextAt: now + 100_000, ratings: { player: 1000, cpu: 1000 } } };
    await db.update(rooms).set({ state: storeOnlineRoom(room) }).where(eq(rooms.id, row.id));
    const [bot] = await db.select({ token: rooms.syncToken }).from(rooms).where(eq(rooms.id, row.id));
    assert(!('unchanged' in await pollFriendRoom(code, a, bot.token!)));
    delete room.ranked;

    room = { ...room, rulesVersion: ONLINE_RULES_VERSION - 1 };
    await db.update(rooms).set({ state: storeOnlineRoom(room) }).where(eq(rooms.id, row.id));
    const stale = await db.select({ token: rooms.syncToken }).from(rooms).where(eq(rooms.id, row.id));
    const retired = await pollFriendRoom(code, a, stale[0].token!);
    assert(!('unchanged' in retired)); assert.equal(retired.reason, 'rules-updated');
  });
  if (process.env.ONLINE_POLL_BENCHMARK === '1') await t.test('owned native live-state read/write measurements', async () => {
    const { performance } = await import('node:perf_hooks');
    const { createMatch, pass, revealCpuTurn, nextRound, compactMatchReplay } = await import('@workspace/squabblemon-engine/gameEngine');
    let match = createMatch('vibes', 'vibes');
    for (let round = 0; round < 6 && match.phase !== 'complete'; round++) match = nextRound(revealCpuTurn(pass(match, 'player')));
    const fixture = { ...createOnlineRoom(member(a), 'player', Date.now()), match };
    const client = await pool.connect();
    const samples: Record<string, number[]> = {};
    const bytes: Record<string, number> = {};
    try {
      await client.query("create temporary table poll_benchmark_plain (state jsonb); create temporary table poll_benchmark_generated (state jsonb, sync_token text generated always as (md5(state::text)) stored, live_state jsonb generated always as (state - 'match') stored)");
      for (const [format, state] of [['full', fixture], ['compact', { ...fixture, match: compactMatchReplay(match) }]] as const) {
        const payload = JSON.stringify(state); bytes[format] = Buffer.byteLength(payload);
        for (const table of ['plain', 'generated']) {
          await client.query(`truncate poll_benchmark_${table}`);
          await client.query(`insert into poll_benchmark_${table}(state) values ($1)`, [payload]);
        }
        for (let iteration = 0; iteration < 13; iteration++) {
          for (const table of iteration % 2 ? ['generated', 'plain'] : ['plain', 'generated']) {
            let start = performance.now();
            await client.query(`update poll_benchmark_${table} set state = $1`, [payload]);
            (samples[`${format}Write_${table}`] ??= []).push(performance.now() - start);
          }
          for (const projection of iteration % 2 ? ['live_state, sync_token', 'state'] : ['state', 'live_state, sync_token']) {
            const start = performance.now();
            const result = await client.query(`select ${projection} from poll_benchmark_generated`);
            const label = projection === 'state' ? 'archive' : 'live';
            (samples[`${format}Read_${label}`] ??= []).push(performance.now() - start);
            bytes[`${format}Read_${label}`] = Buffer.byteLength(JSON.stringify(result.rows[0]));
          }
        }
      }
    } finally { await client.query('drop table if exists poll_benchmark_plain, poll_benchmark_generated'); client.release(); }
    const median = (values: number[]) => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
    console.log(JSON.stringify({ onlineLiveBenchmark: { workload: 'six-round vibes CPU match; native PostgreSQL loopback, 13 alternating samples; generated columns vs identical unindexed temp tables', node: process.version, bytes, medianMs: Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, median(values)])), samplesMs: samples } }));
  });

});
