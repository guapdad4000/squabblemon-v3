import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { RequestHandler } from 'express';
import { cardCatalog, catalogIdsToEngineIds, ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, ONLINE_RULES_VERSION, CARD_BALANCE_VERSION, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { createKumite, startKumite } from './kumiteEngine';

test('native room retirement: locked neutral exit, recovery and no deployment-caused settlements', { skip: !process.env.DATABASE_URL }, async t => {
  assert.equal(process.env.ONLINE_RETIREMENT_TEST_OWNED, '1', 'Run the fresh owned native PostgreSQL retirement harness.');
  const { db, pool, playerProfilesTable: profiles, onlineRoomsTable: rooms, onlineCommandsTable: commands,
    playerCollectionClaimsTable: claims, kumiteTournamentsTable: tournaments, kumiteWinnersTable: winners, playerMatchesTable: matches, challengeRunsTable: runs } = await import('@workspace/db');
  const { eq, inArray } = await import('drizzle-orm');
  const { accessFriendRoom, createFriendRoom, rankedLobby, cancelRankedSearch } = await import('./onlineMatches');
  const { currentKumite, enterKumiteMatch } = await import('./kumite');
  const users: string[] = [];
  const originalNow = Date.now;
  t.after(async () => { Date.now = originalNow; await db.delete(profiles).where(inArray(profiles.clerkUserId, users)); await pool.end(); });
  async function player() {
    const id = `retirement-${randomUUID()}`; users.push(id);
    await db.insert(profiles).values({ clerkUserId: id, displayName: 'Retirement test', onboardingStep: 'complete',
      softCurrency: 123, packTickets: 2, styleShards: 3, ownedCardIds: cardCatalog.map(c => c.catalogId),
      savedDecks: [{ id: 'custom', name: 'Owned crew', heroCardId: 'hooper', cardIds: [...ROOKIE_CORE_IDS] }] });
    return id;
  }
  const member = (userId: string) => ({ userId, name: 'Retirement test', ready: false,
    deck: { id: 'custom', name: 'Owned crew', hero: 'hooper', cards: catalogIdsToEngineIds([...ROOKIE_CORE_IDS]) } });
  function active(a: string, b: string, ranked = false, bot = false) {
    const now = Date.now();
    let room = joinOnlineRoom(createOnlineRoom(member(a), bot ? 'cpu' : 'player', now), member(b), now);
    if (ranked) room.ranked = { queuedAt: now, heartbeatAt: now, botAfter: now, bot, botNextAt: now,
      ratings: { player: 1000, cpu: 1000 } };
    room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
    return applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
  }
  async function store(room: OnlineRoom) {
    const [row] = await db.insert(rooms).values({ code: randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase(),
      hostUserId: room.members.player.userId, guestUserId: room.ranked?.bot ? null : room.members.cpu?.userId ?? null,
      createRequestId: randomUUID(), state: room as unknown as Record<string, unknown>, expiresAt: new Date(room.expiresAt) }).returning();
    return row;
  }
  const stored = async (id: string) => (await db.select().from(rooms).where(eq(rooms.id, id)))[0].state as unknown as OnlineRoom;
  const accounts = async (ids: string[]) => ({ profiles: await db.select().from(profiles).where(inArray(profiles.clerkUserId, ids)),
    claims: await db.select().from(claims).where(inArray(claims.clerkUserId, ids)) });

  await t.test('concurrent human reconnect/action waits on the room row then retires once without a command or rank receipt', async () => {
    const a = await player(), b = await player();
    const room = { ...active(a, b, true), rulesVersion: ONLINE_RULES_VERSION - 1, deadline: Date.now() - 1 };
    const row = await store(room), before = await accounts([a,b]);
    const owner = await pool.connect(), observer = await pool.connect();
    let reads: Promise<unknown>[] = [];
    try {
      await owner.query('begin'); await owner.query('select id from online_rooms where id = $1 for update', [row.id]);
      reads = [accessFriendRoom(row.code, a), accessFriendRoom(row.code, b, { kind: 'command',
        requestId: randomUUID(), expectedRevision: room.revision, command: { type: 'surrender' } })];
      const until = Date.now() + 5000;
      for (;;) {
        const locks = await observer.query("select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock'");
        if (locks.rows[0].n >= 2) break;
        assert(Date.now() < until, 'both real service operations wait on the native room lock');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      await owner.query('commit');
      const views = await Promise.all(reads) as Awaited<ReturnType<typeof accessFriendRoom>>[];
      for (const view of views) { assert.equal(view.status, 'closed'); assert.equal(view.reason, 'rules-updated');
        assert.equal(view.winner, null); assert.equal(view.ranked?.result, null); assert.deepEqual(view.hand, []); }
    } finally { await owner.query('rollback'); owner.release(); observer.release(); await Promise.allSettled(reads); }
    const after = await stored(row.id);
    assert.equal(after.revision, room.revision + 1); assert.deepEqual(after.match, room.match);
    assert.deepEqual(await accounts([a,b]), before);
    assert.equal((await db.select().from(commands).where(eq(commands.roomId, row.id))).length, 0);
    assert.equal((await createFriendRoom(a, 'custom', row.createRequestId)).reason, 'rules-updated', 'create retry uses normal locked reconnect');
    assert.equal((await stored(row.id)).revision, after.revision);
    await assert.rejects(accessFriendRoom(row.code, await player()), /participant|not found/i);
  });

  await t.test('stale bot rooms close before CPU evaluation and release the ranked slot', async () => {
    const a = await player();
    const room = { ...active(a, 'park-bot:retirement', true, true), rulesVersion: ONLINE_RULES_VERSION - 1,
      deadline: Date.now() - 1, match: {} as OnlineRoom['match'] };
    const row = await store(room), before = await accounts([a]);
    const lobby = await rankedLobby(a);
    assert.equal(lobby.room, null); assert.equal((await stored(row.id)).reason, 'rules-updated');
    assert.deepEqual(await accounts([a]), before);
    const recovered = await accessFriendRoom(row.code, a);
    assert.equal(recovered.status, 'closed'); assert.deepEqual(recovered.events, []);
    const fresh = await rankedLobby(a, { deckId: 'custom', requestId: randomUUID() });
    assert(fresh.room && fresh.room.code !== row.code); assert.equal(fresh.room.status, 'waiting');
    await cancelRankedSearch(a, fresh.room.code);
  });

  await t.test('a stale queued opponent is retired instead of paired; same-key recovery returns its neutral exit', async () => {
    const a = await player(), b = await player(), now = Date.now();
    const room = createOnlineRoom(member(a), 'player', now);
    room.rulesVersion--; room.ranked = { queuedAt: now, heartbeatAt: now, botAfter: now + 60000, bot: false, ratings: { player: 1000 } };
    const row = await store(room);
    const other = await rankedLobby(b, { deckId: 'custom', requestId: randomUUID() });
    assert.equal(other.room?.status, 'waiting'); assert.equal((await stored(row.id)).reason, 'rules-updated');
    const retried = await rankedLobby(a, { deckId: 'custom', requestId: row.createRequestId });
    assert.equal(retried.room?.code, row.code); assert.equal(retried.room?.status, 'closed');
  });

  await t.test('old unissued results grant nothing; an already-issued ranked receipt and balances remain intact', async () => {
    const a = await player(), b = await player();
    let room = active(a,b,true);
    for (let n=0; room.status === 'active' && n<14; n++) room = applyOnlineCommand(room, room.activeSeat, { type:'end-turn' }, Date.now());
    assert.equal(room.status, 'complete');
    const staleRow = await store({ ...room, rulesVersion: room.rulesVersion - 1 }), before = await accounts([a,b]);
    assert.equal((await accessFriendRoom(staleRow.code,a)).reason, 'rules-updated');
    assert.deepEqual(await accounts([a,b]), before);
    const currentRow = await store(room), granted = await accessFriendRoom(currentRow.code,a);
    assert(granted.ranked?.result);
    const issued = await stored(currentRow.id), issuedAccounts = await accounts([a,b]);
    await db.update(rooms).set({ state: { ...issued, rulesVersion: ONLINE_RULES_VERSION - 1 } as unknown as Record<string, unknown> }).where(eq(rooms.id,currentRow.id));
    const recovered = await accessFriendRoom(currentRow.code,a);
    assert.deepEqual(recovered.ranked?.result, granted.ranked?.result);
    assert.deepEqual(await accounts([a,b]), issuedAccounts);
  });

  await t.test('Kumite preflight cancels before cutoff or settlement, closes sibling rooms and preserves completed history', async () => {
    const ids = await Promise.all(Array.from({length:8}, () => player()));
    let state = createKumite(originalNow());
    state.entrants = ids.map((id,index) => ({ id:`entrant-${index}`, member:member(id), seed:null, registeredAt:state.registrationOpensAt }));
    state = startKumite(state, state.entrants.map(e=>e.id), state.startsAt);
    // Preserve one already-completed bracket receipt; it must never be rescored.
    const prior = state.rounds[0][0]; prior.status='complete'; prior.winnerId=prior.entrantIds[0]; prior.reason='played';
    const priorSnapshot = structuredClone(prior);
    const issued: Awaited<ReturnType<typeof store>>[] = [];
    for (const [index, match] of state.rounds[0].slice(1,3).entries()) {
      const [a,b] = match.entrantIds.map(id=>state.entrants.find(e=>e.id===id)!.member.userId);
      const room = active(a,b); room.kumite={tournamentId:state.id,matchId:match.id,roundDeadline:match.deadline};
      room.deadline=match.deadline-1; if (index===0) room.rulesVersion--;
      const row=await store(room); issued.push(row); match.roomCode=row.code; match.roomCodes=[row.code]; match.status='playing';
    }
    await db.insert(tournaments).values({ id:state.id,state:state as unknown as Record<string,unknown>,startsAt:new Date(state.startsAt),endsAt:new Date(state.endsAt) });
    const before=await accounts(ids);
    Date.now=()=>state.endsAt+1;
    try {
      const views=await Promise.all([currentKumite(ids[0]), currentKumite(ids[1])]);
      for(const view of views) { assert.equal(view.tournament.status,'cancelled'); assert.equal(view.tournament.cancellationReason,'rules-updated'); assert.equal(view.currentMatch,null); assert.equal(view.tournament.champion,null); }
      const saved=(await db.select().from(tournaments).where(eq(tournaments.id,state.id)))[0].state as unknown as typeof state;
      assert.deepEqual(saved.rounds[0][0],priorSnapshot);
      for(const row of issued) { const retired=await stored(row.id); assert.equal(retired.reason,'rules-updated'); assert.equal(retired.winner,null); }
      const retry=await enterKumiteMatch(ids[0]); assert.equal(retry.room,null); assert.equal(retry.current.tournament.status,'cancelled');
      assert.deepEqual(await accounts(ids),before);
      assert.equal((await db.select().from(winners).where(eq(winners.tournamentId,state.id))).length,0);
      assert.deepEqual((await db.select().from(tournaments).where(eq(tournaments.id,state.id)))[0].state,saved);
    } finally { Date.now=originalNow; }
  });
  await t.test('stale challenge replay rejects safely and concurrent resumes replace one match inside the same entry', async () => {
    const userId = await player();
    const durableAccount = async () => {
      const account = await accounts([userId]);
      return { ...account, profiles: account.profiles.map(({ lastActiveAt, updatedAt, ...profile }) => profile) };
    };
    const { createApp } = await import('../app');
    const authMiddleware: RequestHandler = (req, _res, next) => {
      const auth = () => ({ actor: undefined, debug: () => '', getToken: async () => null, has: () => false,
        isAuthenticated: true, orgId: null, orgRole: null, orgSlug: null, sessionClaims: { sub: userId },
        sessionId: `retirement-${userId}`, tokenType: 'session_token', userId });
      Object.assign(auth, { [Symbol.for('@clerk/express.auth')]: true });
      Object.assign(req, { auth }); next();
    };
    const server = createApp(authMiddleware).listen(0);
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/player`;
    const post = async (path: string, body: unknown, allowed = [200]) => {
      const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as Record<string, any>;
      assert(allowed.includes(response.status), `${response.status}: ${JSON.stringify(result)}`);
      return result;
    };
    try {
      const run = await post('/challenges/runs', { deckId: 'custom' }, [201]);
      const start = { mode: 'practice', playerDeckId: 'custom', challengeRunId: run.id };
      const issued = await post('/matches', start, [201]);
      const prefix = [{ cardInstanceId: null, lane: null, squabble: false, endTurn: true }];
      await post(`/challenges/runs/${run.id}/checkpoint`, { moves: prefix });
      const [current] = await db.select().from(matches).where(eq(matches.id, issued.id));
      await db.update(matches).set({ playerCardProgressionSnapshot: {
        ...current.playerCardProgressionSnapshot!, balanceRulesVersion: CARD_BALANCE_VERSION - 1,
      } }).where(eq(matches.id, issued.id));
      const [archived] = await db.select().from(matches).where(eq(matches.id, issued.id));
      const [originalRun] = await db.select().from(runs).where(eq(runs.id, run.id));
      const before = await durableAccount();
      // This history is intentionally invalid. Compatibility must win before
      // replay/prefix checks, never report cheating or settle a false loss.
      for (const path of [`/challenges/runs/${run.id}/checkpoint`, `/matches/${issued.id}/complete`]) {
        const rejected = await post(path, { moves: [{ cardInstanceId: 'old-rule-card', lane: 0, squabble: true }] }, [409]);
        assert.equal(rejected.code, 'rules-updated');
      }
      assert.deepEqual((await db.select().from(runs).where(eq(runs.id, run.id)))[0], originalRun);
      assert.deepEqual(await durableAccount(), before);

      const owner = await pool.connect(), observer = await pool.connect();
      let pending: ReturnType<typeof post>[] = [];
      let replacements: Record<string, any>[] = [];
      try {
        await owner.query('begin'); await owner.query('select id from challenge_runs where id=$1 for update', [run.id]);
        pending = Array.from({ length: 2 }, () => post('/matches', start, [200, 201]));
        const until = Date.now() + 5000;
        for (;;) {
          const locks = await observer.query("select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock'");
          if (locks.rows[0].n >= 2) break;
          assert(Date.now() < until, 'all concurrent resumes wait on the real challenge row lock');
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        await owner.query('commit'); replacements = await Promise.all(pending);
      } finally { await owner.query('rollback'); owner.release(); observer.release(); await Promise.allSettled(pending); }
      assert.equal(new Set(replacements.map(result => result.id)).size, 1);
      assert.notEqual(replacements[0].id, issued.id);
      for (const replacement of replacements) {
        assert.equal(replacement.challengeRunId, run.id);
        assert.equal(replacement.checkpoint ?? null, null, 'old-rule prefix is never replayed into the replacement');
        assert.deepEqual(replacement.encounterSnapshot, issued.encounterSnapshot, 'same seeded encounter is retained');
      }
      assert.equal((await post('/matches', start)).id, replacements[0].id);
      const persistedMatches = await db.select().from(matches).where(eq(matches.challengeRunId, run.id));
      assert.equal(persistedMatches.length, 2, 'one archived match plus one replacement');
      assert.deepEqual(persistedMatches.find(match => match.id === issued.id), archived);
      assert.equal(persistedMatches.find(match => match.id === replacements[0].id)?.playerCardProgressionSnapshot?.balanceRulesVersion, CARD_BALANCE_VERSION);
      const [resumed] = await db.select().from(runs).where(eq(runs.id, run.id));
      assert.deepEqual(resumed.checkpoints, originalRun.checkpoints, 'historical prefix remains archived');
      assert.deepEqual(resumed.transcripts, originalRun.transcripts);
      for (const key of ['entryDate', 'entryNumber', 'seed', 'encounterIndex', 'wins', 'score', 'crewSnapshot'] as const) {
        assert.deepEqual(resumed[key], originalRun[key], key);
      }
      assert.equal((await db.select().from(runs).where(eq(runs.clerkUserId, userId))).length, 1, 'no second daily entry');
      assert.deepEqual(await durableAccount(), before, 'wallet, inventory and reward ledger are unchanged');
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });

});
