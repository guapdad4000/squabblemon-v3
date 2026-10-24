import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { cardCatalog, ROOKIE_CORE_IDS, catalogIdsToEngineIds } from '@workspace/squabblemon-engine/data';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';

// Native PostgreSQL is required here: a one-connection PGlite run cannot prove
// that different completed rooms serialize their daily cap on the profile row.
test('ranked Clout: native settlement, independent-room cap races, retries and wallet recovery', { skip: !process.env.DATABASE_URL }, async t => {
  assert.equal(process.env.RANKED_CLOUT_TEST_OWNED, '1', 'Run the owned native PostgreSQL ranked-clout harness.');
  const { db, pool, playerProfilesTable: profiles, onlineRoomsTable: rooms, playerCollectionClaimsTable: claims } = await import('@workspace/db');
  const { eq, inArray, sql } = await import('drizzle-orm');
  const { accessFriendRoom } = await import('./onlineMatches');
  const { bankRankedMatchClout, rankedCloutClaimsForDay } = await import('./rankedMatchClout');
  const { getPlayerBootstrap } = await import('./playerState');
  const users: string[] = [];
  t.after(async () => { await db.delete(profiles).where(inArray(profiles.clerkUserId, users)); await pool.end(); });
  async function player(prefix = 'a') {
    const user = `${prefix}-ranked-clout-${randomUUID()}`; users.push(user);
    await db.insert(profiles).values({ clerkUserId: user, displayName: 'Clout tester', onboardingStep: 'complete', ownedCardIds: cardCatalog.map(c => c.catalogId),
      savedDecks: [{ id: 'custom', name: 'Rookie gang', heroCardId: 'hooper', cardIds: [...ROOKIE_CORE_IDS] }] });
    return user;
  }
  function finished(host: string, rival: string, overrides: Partial<OnlineRoom> = {}) {
    const now = Date.now();
    const member = (userId: string) => ({ userId, name: 'Clout tester', ready: false, deck: { id: 'custom', name: 'Rookie gang', hero: 'hooper', cards: catalogIdsToEngineIds([...ROOKIE_CORE_IDS]) } });
    let room = joinOnlineRoom(createOnlineRoom(member(host), 'player', now), member(rival), now);
    room = { ...room, ranked: { queuedAt: now, heartbeatAt: now, botAfter: now + 6000, bot: false, ratings: { player: 1000, cpu: 1000 } } };
    room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
    room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
    for (let turns = 0; room.status === 'active' && turns < 12; turns++) room = applyOnlineCommand(room, room.activeSeat, { type: 'end-turn' }, now + turns);
    assert.equal(room.status, 'complete'); assert.equal(room.reason, 'districts'); assert.equal(room.winner, 'draw');
    return { ...room, ...overrides };
  }
  async function store(room: OnlineRoom) {
    const code = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const [row] = await db.insert(rooms).values({ code, hostUserId: room.members.player.userId, guestUserId: room.ranked?.bot ? null : room.members.cpu!.userId,
      createRequestId: randomUUID(), state: room as unknown as Record<string, unknown>, expiresAt: new Date(room.expiresAt) }).returning();
    return row;
  }
  const wallet = async (user: string) => (await db.select().from(profiles).where(eq(profiles.clerkUserId, user)))[0];
  const ledger = async (user: string) => (await db.select().from(claims).where(eq(claims.clerkUserId, user))).filter(row => row.reward.rankedMatchClout);
  const settle = async (row: Awaited<ReturnType<typeof store>>, user = row.hostUserId) => (await accessFriendRoom(row.code, user)).ranked?.result?.matchClout;
  async function bank(user: string, room: OnlineRoom, id: string, now: number, rollback = false) {
    return db.transaction(async tx => {
      await tx.select().from(profiles).where(eq(profiles.clerkUserId, user)).for('update');
      const result = await bankRankedMatchClout(tx, room, 'player', id, now);
      await tx.update(profiles).set({ softCurrency: sql`${profiles.softCurrency} + ${result.delta}` }).where(eq(profiles.clerkUserId, user));
      if (rollback) throw new Error('Injected rollback after both ledger and wallet update');
      return result;
    });
  }

  await t.test('server outcomes pay 50/20/10 and both seats reconnect to the same saved receipt', async () => {
    for (const [winner, amount, rivalAmount] of [['player', 50, 10], ['draw', 20, 20], ['cpu', 10, 50]] as const) {
      const host = await player(), rival = await player('z');
      // The battle is completed by the real engine; winner overrides isolate the
      // settlement outcomes, not combat resolution, in this transaction test.
      const row = await store(finished(host, rival, { winner }));
      const first = await settle(row); assert.equal(first?.softCurrency, amount); assert.equal(first?.status, 'saved');
      assert.equal(first?.paidMatchesToday, 1); assert.equal(first?.dailyLimit, 5);
      assert.equal(first?.receiptId, `ranked-clout:${row.id}:1:player`);
      const [again, other] = await Promise.all([settle(row), settle(row, rival)]);
      assert.deepEqual(again, first); assert.equal(other?.softCurrency, rivalAmount);
      assert.equal((await wallet(host)).softCurrency, amount); assert.equal((await wallet(rival)).softCurrency, rivalAmount);
      assert.equal((await getPlayerBootstrap(host)).profile.softCurrency, amount, 'the actual wallet bootstrap contains the saved match payout');
      assert.equal((await ledger(host)).length, 1);
    }
  });

  await t.test('same-room concurrent claims save one payout and one rating change per player', async () => {
    const host = await player(), rival = await player('z'), row = await store(finished(host, rival));
    const results = await Promise.all(Array.from({ length: 8 }, () => settle(row)));
    for (const result of results) assert.deepEqual(result, results[0]);
    assert.equal((await wallet(host)).softCurrency, 20); assert.equal((await ledger(host)).length, 1);
    assert.equal(((await wallet(host)).storyProgress.fadePark as { games: number }).games, 1);
  });

  await t.test('different rooms contend on one profile at the fifth payout, concurrent bootstrap cannot erase it', async () => {
    const host = await player();
    for (let n = 0; n < 4; n++) await settle(await store(finished(host, await player('z'))));
    assert.equal((await wallet(host)).softCurrency, 80);
    const rows = await Promise.all([player('z'), player('z')].map(async rivalPromise => store(finished(host, await rivalPromise))));
    const owner = await pool.connect(), observer = await pool.connect();
    let pending: ReturnType<typeof settle>[] = [], bootstrap: ReturnType<typeof getPlayerBootstrap> | undefined;
    try {
      await owner.query('begin'); await owner.query('select clerk_user_id from player_profiles where clerk_user_id = $1 for update', [host]);
      pending = rows.map(row => settle(row));
      const deadline = Date.now() + 5000;
      for (;;) {
        const blocked = await observer.query("select count(*)::int as count from pg_stat_activity where wait_event_type = 'Lock' and query like '%player_profiles%' and pid <> pg_backend_pid()");
        if (Number(blocked.rows[0].count) >= 2) break;
        assert.ok(Date.now() < deadline, 'both independent room transactions must wait on the same player profile lock');
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      bootstrap = getPlayerBootstrap(host);
      await owner.query('commit');
      const results = await Promise.all(pending); await bootstrap;
      assert.deepEqual(results.map(r => r?.status).sort(), ['daily-limit', 'saved']);
      assert.deepEqual(results.map(r => r?.softCurrency).sort((a, b) => a! - b!), [0, 20]);
      assert.ok(results.every(r => r?.paidMatchesToday === 5));
      assert.equal((await wallet(host)).softCurrency, 100);
      assert.equal((await ledger(host)).filter(row => row.reward.rankedMatchClout?.status === 'saved').length, 5);
      const retries = await Promise.all(rows.flatMap(row => [settle(row), settle(row)]));
      assert.deepEqual(retries.slice(0, 2), [results[0], results[0]]); assert.deepEqual(retries.slice(2), [results[1], results[1]]);
      assert.equal((await getPlayerBootstrap(host)).profile.softCurrency, 100);
    } finally {
      await owner.query('rollback'); owner.release(); observer.release();
      await Promise.allSettled(pending); await bootstrap;
    }
  });

  await t.test('friend fades, bots, surrender and timeout do not pay or consume a human match slot', async () => {
    const host = await player(), rival = await player('z');
    for (const reason of ['surrender', 'timeout'] as const) {
      const receipt = await settle(await store(finished(host, rival, { reason, winner: 'cpu' })));
      assert.equal(receipt?.status, 'ineligible'); assert.equal(receipt?.softCurrency, 0);
    }
    const botRoom = finished(host, rival); botRoom.ranked!.bot = true;
    const bot = await settle(await store(botRoom)); assert.equal(bot?.exclusion, 'bot'); assert.equal(bot?.softCurrency, 0);
    const friendly = await settle(await store(finished(host, rival, { ranked: undefined })));
    assert.equal(friendly, undefined); assert.equal((await wallet(host)).softCurrency, 0);
    const human = await settle(await store(finished(host, rival))); assert.equal(human?.paidMatchesToday, 1); assert.equal(human?.softCurrency, 20);
  });

  await t.test('UTC cap reset does not replay yesterday receipts, and another game has a distinct receipt', async () => {
    const host = await player(), rival = await player('z'), room = finished(host, rival);
    const day = Date.parse('2026-10-24T23:59:59Z'), ids = Array.from({ length: 6 }, () => randomUUID());
    for (const id of ids.slice(0, 5)) assert.equal((await bank(host, room, id, day)).delta, 20);
    const capped = await bank(host, room, ids[5], day); assert.equal(capped.receipt.status, 'daily-limit');
    assert.equal(capped.receipt.resetsAt, '2026-10-25T00:00:00.000Z');
    const oldRetry = await bank(host, room, ids[5], day + 2000); assert.deepEqual(oldRetry.receipt, capped.receipt); assert.equal(oldRetry.delta, 0);
    const next = await bank(host, { ...room, gameNumber: 2 }, ids[5], day + 2000);
    assert.equal(next.receipt.date, '2026-10-25'); assert.equal(next.receipt.paidMatchesToday, 1); assert.equal(next.delta, 20);
    assert.notEqual(next.receipt.receiptId, capped.receipt.receiptId); assert.equal((await wallet(host)).softCurrency, 120);
    const rows = await ledger(host);
    for (const row of rows) assert.equal(row.createdAt.toISOString().slice(0, 10), row.reward.rankedMatchClout!.date, 'ledger timestamp and receipt use the same authoritative server time');
    assert.equal(rows.find(row => row.reward.rankedMatchClout!.receiptId === next.receipt.receiptId)!.createdAt.getTime(), day + 2000);

  });

  await t.test('daily count has an indexable player/date range and leaves old history outside the scan', async () => {
    const host = await player();
    await db.insert(claims).values(Array.from({ length: 80 }, (_, n) => ({ clerkUserId: host, milestoneKey: `old-receipt:${n}`, createdAt: new Date('2025-01-01T00:00:00Z'), reward: {} })));
    const plan = await db.transaction(async tx => {
      await tx.execute(sql`set local enable_seqscan = off`);
      const query = tx.select({ paid: sql<number>`count(*)::integer` }).from(claims).where(rankedCloutClaimsForDay(host, '2026-10-24'));
      const result = await tx.execute(sql`explain (format json) ${query}`);
      return (result.rows[0] as { 'QUERY PLAN': [{ Plan: Record<string, unknown> }] })['QUERY PLAN'][0].Plan;
    });
    const nodes = (node: Record<string, unknown>): Record<string, unknown>[] => [node, ...((node.Plans ?? []) as Record<string, unknown>[]).flatMap(nodes)];
    const scan = nodes(plan).find(node => node['Index Name'] === 'player_collection_claims_user_created');
    assert.ok(scan, 'the actual daily-count predicate can use the composite timestamp index');
    assert.match(String(scan['Index Cond']), /clerk_user_id.*created_at >=.*created_at </, 'both day bounds belong to the index condition');
  });

  await t.test('wallet and receipt roll back together, then a retry can save the award', async () => {
    const host = await player(), rival = await player('z'), room = finished(host, rival), id = randomUUID();
    await assert.rejects(bank(host, room, id, Date.now(), true), /Injected rollback/);
    assert.equal((await wallet(host)).softCurrency, 0); assert.equal((await ledger(host)).length, 0);
    assert.equal((await bank(host, room, id, Date.now())).delta, 20); assert.equal((await wallet(host)).softCurrency, 20);
  });
});
