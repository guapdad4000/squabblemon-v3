import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cardCatalog, KUMITE_CARD_REWARDS, KUMITE_EXCLUSIVE_CARD_IDS, ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';
import type { OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { kumiteWeek, type KumiteCurrentView, type KumiteState } from './kumiteEngine';

test('real Kumite routes: authenticated locked signup, capacity race, authoritative matches and immutable history',
  { skip: !process.env.DATABASE_URL }, async t => {
    const { default: express } = await import('express');
    const { db, pool, playerProfilesTable, onlineRoomsTable, kumiteTournamentsTable, kumiteWinnersTable, playerCollectionClaimsTable } = await import('@workspace/db');
    const { eq, inArray, sql } = await import('drizzle-orm');
    const { default: kumiteRouter } = await import('../routes/kumite');
    const { default: multiplayerRouter } = await import('../routes/multiplayer');
    const originalNow = Date.now;
    const week = kumiteWeek(originalNow());
    let now = week.registrationOpensAt + 1;
    Date.now = () => now;
    const users = Array.from({ length: 10 }, () => `kumite-test-${randomUUID()}`);
    const roadmapIds = KUMITE_CARD_REWARDS.map(reward => reward.cardId) as readonly string[];
    await db.insert(playerProfilesTable).values(users.map((clerkUserId, index) => ({ clerkUserId,
      displayName: `Kumite Fighter ${index}`, onboardingStep: 'complete', ownedCardIds: cardCatalog.filter(card => !roadmapIds.includes(card.catalogId)).map(card => card.catalogId),
      savedDecks: [{ id: 'custom', name: 'Tournament gang', heroCardId: 'hooper', cardIds: [...ROOKIE_CORE_IDS] }],
    })));
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const userId = req.header('x-test-user') || null;
      (req as unknown as { auth: unknown }).auth = Object.assign(() => ({ userId,
        sessionId: userId ? 'test' : null, tokenType: 'session_token', isAuthenticated: !!userId,
      }), { [Symbol.for('@clerk/express.auth')]: true });
      next();
    });
    app.use('/api', kumiteRouter, multiplayerRouter);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
    t.after(async () => {
      Date.now = originalNow;
      await new Promise<void>(resolve => server.close(() => resolve()));
      await db.delete(playerProfilesTable).where(inArray(playerProfilesTable.clerkUserId, users));
      await pool.end();
    });
    const request = async (user: string, path: string, body?: unknown) => {
      const response = await fetch(origin + path, { method: body !== undefined ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'x-test-user': user },
        body: body !== undefined ? JSON.stringify(body) : undefined });
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      return { status: response.status, body: await response.json() as KumiteCurrentView & {
        error?: string; room?: OnlineRoomView; current?: KumiteCurrentView;
        winners?: { tournamentId: string; name: string; entrantCount: number }[];
      } };
    };
    assert.equal((await request('', '/kumite/current')).status, 200);
    assert.equal((await request('', '/kumite/register', { deckId: 'custom' })).status, 401);
    assert.equal((await request(users[0], '/kumite/register', { deckId: 'missing' })).status, 400);
    assert.equal((await request(users[0], '/kumite/register', { deckId: 'custom', winnerId: users[0] })).status, 400);
    const duplicate = await Promise.all([0, 1].map(() => request(users[0], '/kumite/register', { deckId: 'custom' })));
    assert(duplicate.every(result => result.status === 200));
    assert.equal(duplicate[1].body.tournament.entrants.length, 1);
    const race = await Promise.all(users.slice(1, 9).map(user => request(user, '/kumite/register', { deckId: 'custom' })));
    assert.equal(race.filter(result => result.status === 200).length, 7);
    assert.equal(race.filter(result => result.status === 409).length, 1);
    let current = (await request(users[0], '/kumite/current')).body;
    assert.equal(current.tournament.entrants.length, 8);
    assert.equal(current.tournament.capacity, 8);
    assert(!JSON.stringify(current).includes(users[0]));
    assert.equal((await request(users[0], '/kumite/withdraw', {})).status, 200);
    assert.equal((await request(users[0], '/kumite/withdraw', {})).status, 200);
    assert.equal((await request(users[0], '/kumite/register', { deckId: 'custom' })).status, 200);
    // A later collection/deck edit cannot change the gang already issued for this tournament.
    await db.update(playerProfilesTable).set({ savedDecks: [] }).where(eq(playerProfilesTable.clerkUserId, users[0]));
    assert.equal((await request(users[0], '/kumite/register', { deckId: 'custom' })).status, 200);
    now = week.startsAt + 1;
    current = (await request(users[0], '/kumite/current')).body;
    assert.equal(current.tournament.status, 'active');
    assert.deepEqual(current.tournament.finals.map(round => round.length), [4, 2, 1]);
    assert.equal((await request(users[0], '/kumite/withdraw', {})).status, 409);
    assert.equal((await request(users[9], '/kumite/match', {})).status, 403);
    const [record] = await db.select().from(kumiteTournamentsTable).where(eq(kumiteTournamentsTable.id, week.id));
    const state = record.state as unknown as KumiteState;
    const entrantUser = (id: string) => state.entrants.find(entry => entry.id === id)!.member.userId;
    let first = true;
    for (const round of current.tournament.finals) {
      for (const game of round) {
        current = (await request(users[0], '/kumite/current')).body;
        const match = current.tournament.finals.flat().find(item => item.id === game.id)!;
        assert(['ready', 'playing'].includes(match.status));
        const host = entrantUser(match.entrants[0]!.id), guest = entrantUser(match.entrants[1]!.id);
        const entered = await request(host, '/kumite/match', {});
        assert.equal(entered.status, 200, JSON.stringify(entered.body));
        let view = entered.body.room!;
        const again = await request(host, '/kumite/match', {});
        assert.equal(again.body.room!.code, view.code, 'check-in retry issues one room');
        if (!first) await request(guest, '/kumite/match', {});
        const outsider = users.find(user => user !== host && user !== guest)!;
        assert.equal((await request(outsider, `/multiplayer/${view.code}`)).status, 404);
        const action = (user: string, command: object) => request(user, `/multiplayer/${view.code}/actions`, {
          requestId: randomUUID(), expectedRevision: view.revision, command,
        });
        if (first) {
          let result = await action(host, { type: 'ready' });
          assert.equal(result.status, 200); view = result.body as unknown as OnlineRoomView;
          result = await action(guest, { type: 'ready' });
          assert.equal(result.status, 200); view = result.body as unknown as OnlineRoomView;
          assert.equal(view.status, 'active');
          const reconnected = (await request(host, '/kumite/current')).body;
          assert.deepEqual(reconnected.currentMatch!.checkedIn, [true, true], 'readying directly in the assigned room also checks in');
          const [storedRoom] = await db.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, view.code));
          assert.equal((storedRoom.state as any).members.player.deck.cards.length, 10);
          // Reconcile two rooms in one transaction: the first settlement clones
          // the bracket, and the second room's direct-ready check-in must survive.
          const other = current.tournament.finals[0][1];
          const otherHost = entrantUser(other.entrants[0]!.id), otherGuest = entrantUser(other.entrants[1]!.id);
          const otherView = (await request(otherHost, '/kumite/match', {})).body.room!;
          assert.equal((await request(otherGuest, `/multiplayer/${otherView.code}/actions`, {
            requestId: randomUUID(), expectedRevision: otherView.revision, command: { type: 'ready' },
          })).status, 200);
          result = await action(guest, { type: 'surrender' });
          assert.equal(result.status, 200); view = result.body as unknown as OnlineRoomView;
          assert.equal(view.status, 'complete');
          assert.equal((await action(host, { type: 'rematch' })).status, 409);
          const refreshed = (await request(host, '/kumite/current')).body;
          assert.deepEqual(refreshed.tournament.finals[0][1].checkedIn, [true, true]);
          first = false;
        } else {
          const result = await action(guest, { type: 'surrender' });
          assert.equal(result.status, 200, JSON.stringify(result.body));
        }
        current = (await request(host, '/kumite/current')).body;
        assert.equal(current.tournament.finals.flat().find(item => item.id === match.id)!.winner?.id, match.entrants[0]!.id);
      }
    }
    assert.equal(current.tournament.status, 'complete');
    assert.equal(current.progression!.completedMatches, 0, 'surrendered brackets do not count as full battles');
    assert.equal(current.progression!.championships, 0, 'a surrendered final cannot farm Chonk Lee');
    assert(current.progression!.rewards.every(reward => !reward.claimed));
    assert.deepEqual(current.records, { scope: 'Last 52 weekly tournaments', fastestFight: null, recentWinners: [], handThrowers: [] },
      'surrendered brackets cannot supply full-fight records');
    const winners = (await request('', '/kumite/winners')).body.winners!;
    assert.equal(winners.filter(winner => winner.tournamentId === week.id).length, 1);
    assert.equal(winners.find(winner => winner.tournamentId === week.id)!.entrantCount, 8);
    // Apply the production migration's archival trigger to the owned test database.
    const migration = readFileSync(new URL('../../../../netlify/database/migrations/202610130001_kumite/migration.sql', import.meta.url), 'utf8');
    await db.execute(sql.raw(migration));
    const immutable = (error: unknown) => /immutable/.test(String((error as { cause?: unknown }).cause ?? error));
    await assert.rejects(db.update(kumiteWinnersTable).set({ weekLabel: 'fabricated' }).where(eq(kumiteWinnersTable.tournamentId, week.id)), immutable);
    await assert.rejects(db.delete(kumiteWinnersTable).where(eq(kumiteWinnersTable.tournamentId, week.id)), immutable);
    const championName = winners.find(winner => winner.tournamentId === week.id)!.name;
    await db.update(playerProfilesTable).set({ displayName: 'Changed later' }).where(eq(playerProfilesTable.clerkUserId, users[0]));
    assert.equal((await request('', '/kumite/winners')).body.winners!.find(winner => winner.tournamentId === week.id)!.name, championName);
    now = week.endsAt + 60_000;
    assert.equal((await request('', '/kumite/winners')).body.winners!.filter(winner => winner.tournamentId === week.id).length, 1);
    now = week.registrationOpensAt + 7 * 24 * 60 * 60 * 1000;
    // Native cron invokes the same authoritative service without a browser or session.
    const { default: scheduledTick, config: tickConfig } = await import('../netlify/functions/kumite-tick.mjs');
    assert.equal(tickConfig.schedule, '*/15 * * * *');
    assert.equal((await scheduledTick()).status, 200);
    const following = (await request('', '/kumite/current')).body;
    assert.equal(following.tournament.status, 'registration');
    assert.equal(following.tournament.entrants.length, 0);
    // A second week proves real gameplay unlocks, persistent progress and exactly-once grants.
    await db.update(playerProfilesTable).set({ savedDecks: [{ id: 'custom', name: 'Tournament gang', heroCardId: 'hooper', cardIds: [...ROOKIE_CORE_IDS] }] })
      .where(inArray(playerProfilesTable.clerkUserId, users.slice(0, 2)));
    for (const user of users.slice(0, 2)) assert.equal((await request(user, '/kumite/register', { deckId: 'custom' })).status, 200);
    now = following.tournament.startsAt + 1;
    let realCurrent = (await request(users[0], '/kumite/current')).body;
    const [realRecord] = await db.select().from(kumiteTournamentsTable).where(eq(kumiteTournamentsTable.id, realCurrent.tournament.id));
    const realState = realRecord.state as unknown as KumiteState;
    const realMatch = realCurrent.tournament.finals[2][0];
    const realHost = realState.entrants.find(entry => entry.id === realMatch.entrants[0]!.id)!.member.userId;
    const realGuest = realState.entrants.find(entry => entry.id === realMatch.entrants[1]!.id)!.member.userId;
    let realView = (await request(realHost, '/kumite/match', {})).body.room!;
    await request(realGuest, '/kumite/match', {});
    const realAction = async (user: string, command: object) => {
      now += 1_000;
      const result = await request(user, `/multiplayer/${realView.code}/actions`, { requestId: randomUUID(), expectedRevision: realView.revision, command });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      realView = result.body as unknown as OnlineRoomView;
    };
    await realAction(realHost, { type: 'ready' });
    await realAction(realGuest, { type: 'ready' });
    const startedAt = realView.startedAt!;
    let plays = 0;
    while (realView.status === 'active') {
      const actor = realView.activeSeat === 'player' ? realHost : realGuest;
      realView = (await request(actor, `/multiplayer/${realView.code}`)).body as unknown as OnlineRoomView;
      if (actor === realHost) {
        for (let step = 0; step < 10; step++) {
          const lane = ([0, 1, 2] as const).find(candidate => realView.boards[candidate].filter(card => card.owner === 'player' && !card.hazard).length < 4 &&
            realView.hand.some(card => card.costs[candidate] <= realView.motion.player));
          if (lane === undefined) break;
          const card = realView.hand.find(card => card.costs[lane] <= realView.motion.player)!;
          await realAction(realHost, { type: 'play', instanceId: card.instanceId, lane, squabble: false });
          plays++;
        }
      }
      await realAction(actor, { type: 'end-turn' });
    }
    assert(plays > 0);
    assert.equal(realView.reason, 'districts');
    assert.equal(realView.winner, 'player');
    const completedAt = realView.completedAt!;
    const polls = await Promise.all(Array.from({ length: 8 }, () => request(realHost, '/kumite/current')));
    assert(polls.every(result => result.status === 200));
    realCurrent = polls[0].body;
    assert.equal(realCurrent.tournament.finals[2][0].startedAt, startedAt);
    assert.equal(realCurrent.tournament.finals[2][0].completedAt, completedAt);
    assert.equal(realCurrent.tournament.finals[2][0].durationMs, completedAt - startedAt);
    assert(completedAt > startedAt);
    assert.deepEqual([realCurrent.progression!.completedMatches, realCurrent.progression!.matchWins, realCurrent.progression!.championships], [1, 1, 1]);
    assert(realCurrent.progression!.rewards.filter(reward => (KUMITE_EXCLUSIVE_CARD_IDS as readonly string[]).includes(reward.cardId))
      .every(reward => reward.claimed && reward.owned));
    assert(realCurrent.progression!.rewards.filter(reward => !(KUMITE_EXCLUSIVE_CARD_IDS as readonly string[]).includes(reward.cardId))
      .every(reward => !reward.claimed && !reward.owned));
    assert.equal(realCurrent.records.fastestFight!.durationMs, completedAt - startedAt);
    assert.equal(realCurrent.records.recentWinners.length, 1);
    assert.equal(realCurrent.records.handThrowers[0].playedWins, 1);
    assert.equal(realCurrent.records.handThrowers[0].championships, 1);
    assert(!JSON.stringify(realCurrent.records).includes(realHost));
    const { kumiteRecordRoomProof } = await import('./kumite');
    const { buildKumiteRecords } = await import('./kumiteRecords');
    const [proofRow] = await db.select({ full: onlineRoomsTable.state, proof: kumiteRecordRoomProof })
      .from(onlineRoomsTable).where(eq(onlineRoomsTable.code, realView.code));
    const [finishedTournament] = await db.select({ state: kumiteTournamentsTable.state })
      .from(kumiteTournamentsTable).where(eq(kumiteTournamentsTable.id, realCurrent.tournament.id));
    assert.deepEqual(buildKumiteRecords([finishedTournament.state as unknown as KumiteState],
      new Map([[realView.code, proofRow.proof]])), realCurrent.records,
      'compact SQL receipt produces the same verified public records as the complete battle');
    const fullRoomBytes = Buffer.byteLength(JSON.stringify(proofRow.full));
    const recordProofBytes = Buffer.byteLength(JSON.stringify(proofRow.proof));
    assert(recordProofBytes * 10 < fullRoomBytes, 'record polling omits the heavyweight hands, board and effect log');
    t.diagnostic(JSON.stringify({ recordPayloadMeasurement: { fullRoomBytes, recordProofBytes,
      maximumRecordRooms: 52 * 7, proofBytesFor364EquivalentRooms: recordProofBytes * 52 * 7 } }));
    const loser = (await request(realGuest, '/kumite/current')).body.progression!;
    assert.deepEqual([loser.completedMatches, loser.matchWins, loser.championships], [1, 0, 0]);
    assert.equal(loser.rewards.filter(reward => reward.claimed).length, 1);
    const [earned] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, realHost));
    const receipts = await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, realHost));
    for (const cardId of KUMITE_EXCLUSIVE_CARD_IDS) {
      assert.equal(earned.ownedCardIds.filter(id => id === cardId).length, 1);
      assert.equal(earned.discoveredCardIds.filter(id => id === cardId).length, 1);
      assert.equal(receipts.filter(receipt => receipt.milestoneKey === `kumite:card:${cardId}:v1`).length, 1);
    }
    assert.equal((await request(realHost, `/multiplayer/${realView.code}/actions`, { requestId: randomUUID(), expectedRevision: realView.revision, command: { type: 'rematch' } })).status, 409);
    assert.deepEqual((await request(realHost, '/kumite/current')).body.progression, realCurrent.progression);
    // Past-week totals persist, while an unattended later week creates no new credit.
    now = following.tournament.registrationOpensAt + 7 * 24 * 60 * 60 * 1000;
    const thirdWeek = (await request(realHost, '/kumite/current')).body;
    assert.deepEqual(thirdWeek.progression, realCurrent.progression);
    assert.equal(thirdWeek.tournament.entrants.length, 0);
    for (const user of users.slice(8, 10)) await request(user, '/kumite/register', { deckId: 'custom' });
    now = thirdWeek.tournament.startsAt + 1;
    let timeoutView = (await request(users[8], '/kumite/match', {})).body.room!;
    await request(users[9], '/kumite/match', {});
    for (const user of users.slice(8, 10)) {
      const result = await request(user, `/multiplayer/${timeoutView.code}/actions`, {
        requestId: randomUUID(), expectedRevision: timeoutView.revision, command: { type: 'ready' },
      });
      assert.equal(result.status, 200); timeoutView = result.body as unknown as OnlineRoomView;
    }
    now = timeoutView.deadline! + 1;
    for (const user of users.slice(8, 10)) {
      const timeoutProgress = (await request(user, '/kumite/current')).body.progression!;
      assert.deepEqual([timeoutProgress.completedMatches, timeoutProgress.matchWins, timeoutProgress.championships], [0, 0, 0], 'actual turn timeouts grant no exclusive cards');
      assert(timeoutProgress.rewards.every(reward => !reward.claimed));
    }
    now = thirdWeek.tournament.registrationOpensAt + 7 * 24 * 60 * 60 * 1000;
    const emptyWeek = (await request(realHost, '/kumite/current')).body;
    assert.deepEqual(emptyWeek.progression, realCurrent.progression);
    now = emptyWeek.tournament.endsAt + 1;
    const unattendedResult = await (await scheduledTick()).json() as { status: string };
    assert.equal(unattendedResult.status, 'cancelled', 'cron catches up an unattended week without fabricated entrants or winners');
    const [unattended] = await db.select().from(kumiteTournamentsTable).where(eq(kumiteTournamentsTable.id, emptyWeek.tournament.id));
    assert.equal((unattended.state as unknown as KumiteState).status, 'cancelled');
    // Seven additional legal HTTP finals exercise every lifetime roadmap threshold.
    // An already-owned existing fighter must keep its XP when its milestone is reached.
    const [beforeRoad] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, realHost));
    await db.update(playerProfilesTable).set({ ownedCardIds: [...beforeRoad.ownedCardIds, 'undercova-brotha'],
      cardProgression: { ...beforeRoad.cardProgression, 'undercova-brotha': { xp: 12, level: 6 } } })
      .where(eq(playerProfilesTable.clerkUserId, realHost));
    for (let fullWins = 2; fullWins <= 8; fullWins++) {
      now = emptyWeek.tournament.registrationOpensAt + (fullWins - 1) * 7 * 24 * 60 * 60 * 1000;
      for (const user of [realHost, realGuest]) assert.equal((await request(user, '/kumite/register', { deckId: 'custom' })).status, 200);
      const waiting = (await request(realHost, '/kumite/current')).body;
      now = waiting.tournament.startsAt + 1;
      realView = (await request(realHost, '/kumite/match', {})).body.room!;
      await request(realGuest, '/kumite/match', {});
      const winningSeat = realView.seat;
      const seatUsers = winningSeat === 'player' ? { player: realHost, cpu: realGuest } : { player: realGuest, cpu: realHost };
      await realAction(realHost, { type: 'ready' }); await realAction(realGuest, { type: 'ready' });
      while (realView.status === 'active') {
        const actor = seatUsers[realView.activeSeat];
        realView = (await request(actor, `/multiplayer/${realView.code}`)).body as unknown as OnlineRoomView;
        if (actor === realHost) for (let step = 0; step < 10; step++) {
          const lane = ([0, 1, 2] as const).find(candidate => !realView.lockedLanes?.includes(candidate) &&
            realView.boards[candidate].filter(card => card.owner === winningSeat && !card.hazard).length < 4 &&
            realView.hand.some(card => card.costs[candidate] <= realView.motion[winningSeat]));
          if (lane === undefined) break;
          const card = realView.hand.find(card => card.costs[lane] <= realView.motion[winningSeat])!;
          await realAction(realHost, { type: 'play', instanceId: card.instanceId, lane, squabble: false });
        }
        await realAction(actor, { type: 'end-turn' });
      }
      assert.equal(realView.reason, 'districts'); assert.equal(realView.winner, winningSeat);
      const results = await Promise.all(Array.from({ length: 8 }, () => request(realHost, '/kumite/current')));
      const progress = results[0].body.progression!;
      assert(results.every(result => result.status === 200));
      assert.deepEqual([progress.completedMatches, progress.matchWins, progress.championships], [fullWins, fullWins, fullWins]);
      for (const reward of progress.rewards) {
        assert.equal(reward.claimed, reward.progress >= reward.required, reward.cardId);
        assert.equal(reward.rarity, cardCatalog.find(card => card.catalogId === reward.cardId)!.rarity);
        assert.equal(reward.owned, reward.claimed || reward.cardId === 'undercova-brotha');
      }
      assert.equal(results[0].body.records.handThrowers[0].playedWins, fullWins);
      assert.equal(results[0].body.records.recentWinners.length, fullWins);
      if (fullWins === 3) {
        // Model a new roadmap introduced after three genuine earlier victories.
        await db.delete(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.milestoneKey, 'kumite:card:dragonfly-jones:v1'));
        const [profile] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, realHost));
        await db.update(playerProfilesTable).set({ ownedCardIds: profile.ownedCardIds.filter(id => id !== 'dragonfly-jones') })
          .where(eq(playerProfilesTable.clerkUserId, realHost));
        const backfill = await Promise.all(Array.from({ length: 8 }, () => request(realHost, '/kumite/current')));
        assert(backfill.every(result => result.body.progression!.rewards.find(reward => reward.cardId === 'dragonfly-jones')!.claimed));
        assert.equal(backfill[0].body.progression!.matchWins, 3, 'backfill creates no new battle credit');
      }
    }
    const [allEarned] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, realHost));
    const allReceipts = await db.select().from(playerCollectionClaimsTable).where(eq(playerCollectionClaimsTable.clerkUserId, realHost));
    assert.deepEqual(allEarned.cardProgression['undercova-brotha'], { xp: 12, level: 6 });
    for (const reward of KUMITE_CARD_REWARDS) {
      assert.equal(allEarned.ownedCardIds.filter(id => id === reward.cardId).length, 1, reward.cardId);
      assert.equal(allEarned.discoveredCardIds.filter(id => id === reward.cardId).length, 1, reward.cardId);
      assert.equal(allReceipts.filter(receipt => receipt.milestoneKey === reward.id).length, 1, reward.cardId);
    }
  });
