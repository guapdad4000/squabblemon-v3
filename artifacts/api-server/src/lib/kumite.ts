import { restoreOnlineRoom, storeOnlineRoom } from './onlineRoomPersistence';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db, kumiteTournamentsTable, kumiteWinnersTable, onlineRoomsTable, playerProfilesTable } from '@workspace/db';
import {
  createOnlineRoom, expireOnlineRoom, joinOnlineRoom, OnlineError, onlineRoomView, retireOnlineRoomForRulesUpdate,
  type OnlineRoom,
} from '@workspace/squabblemon-engine/multiplayer';
import { loadMember } from './onlineMatches';
import { advanceKumite, createKumite, KUMITE_CAPACITY, kumiteView, kumiteWeek,
  retireIncompatibleKumite, settleKumiteRoom, startKumite, type KumiteState } from './kumiteEngine';
import { kumiteProgression, reconcileKumiteRewards, recordKumiteChampion, recordKumitePlayedRoom } from './kumiteRewards';
import { buildKumiteRecords, createKumiteRecordCache, type KumiteRecordRoom } from './kumiteRecords';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TournamentRow = typeof kumiteTournamentsTable.$inferSelect;
const stored = (state: KumiteState) => state as unknown as Record<string, unknown>;
const restore = (state: Record<string, unknown>) => state as unknown as KumiteState;
const recordCache = createKumiteRecordCache();

/** Bound historical polling to compact proofs; full completed battle logs stay in their rooms. */
export const kumiteRecordRoomProof = sql<KumiteRecordRoom>`jsonb_build_object(
  'status', ${onlineRoomsTable.state}->'status',
  'reason', ${onlineRoomsTable.state}->'reason',
  'ranked', ${onlineRoomsTable.state}->'ranked',
  'gameNumber', ${onlineRoomsTable.state}->'gameNumber',
  'winner', ${onlineRoomsTable.state}->'winner',
  'startedAt', ${onlineRoomsTable.state}->'startedAt',
  'completedAt', ${onlineRoomsTable.state}->'completedAt',
  'kumite', ${onlineRoomsTable.state}->'kumite',
  'members', jsonb_build_object(
    'player', jsonb_build_object('userId', ${onlineRoomsTable.state}#>'{members,player,userId}'),
    'cpu', jsonb_build_object('userId', ${onlineRoomsTable.state}#>'{members,cpu,userId}')
  ),
  'match', jsonb_build_object('phase', ${onlineRoomsTable.state}#>'{match,phase}')
)`;

async function refreshTournament(tx: Tx, row: TournamentRow, now: number): Promise<KumiteState> {
  let state = restore(row.state);
  if (state.status === 'registration' && now >= state.startsAt) {
    const seeds = state.entrants.map(entry => entry.id);
    for (let i = seeds.length - 1; i > 0; i--) {
      const j = randomInt(i + 1); [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
    }
    state = startKumite(state, seeds, now);
  }
  if (state.status === 'active') {
    // Compatibility is a preflight across the bracket, before any result or
    // reward is settled. All these rooms are already locked by currentTransaction.
    const codes = state.rounds.flat().flatMap(match => match.roomCode && match.status !== 'complete' ? [match.roomCode] : []);
    const rooms = codes.length ? await tx.select().from(onlineRoomsTable)
      .where(inArray(onlineRoomsTable.code, codes)).orderBy(asc(onlineRoomsTable.code)).for('update') : [];
    for (const row of rooms) {
      const room = restoreOnlineRoom(row.state);
      const match = state.rounds.flat().find(item => item.roomCode === row.code);
      if (!match || room.kumite?.tournamentId !== state.id || room.kumite?.matchId !== match.id)
        throw new Error('Kumite room receipt mismatch.');
      state = retireIncompatibleKumite(state, room);
    }
    if (state.status === 'cancelled') {
      for (const row of rooms) {
        const previous = restoreOnlineRoom(row.state);
        const retired = retireOnlineRoomForRulesUpdate(previous, now);
        if (retired !== previous) await tx.update(onlineRoomsTable).set({ state: storeOnlineRoom(retired),
          updatedAt: new Date(now), expiresAt: new Date(now) }).where(eq(onlineRoomsTable.id, row.id));
      }
    }
  }
  if (state.status === 'active') {
    // Room and bracket writes share this transaction. Rooms are exclusively server-issued.
    // Settle completed/expired active turns before applying the tournament round cutoff.
    for (const matchId of state.rounds.flat().map(match => match.id)) {
      // Settlement returns a new immutable bracket. Always resolve the match
      // from that latest state before marking subsequent rooms' check-ins.
      const match = state.rounds.flat().find(item => item.id === matchId)!;
      if (!match.roomCode || match.status === 'complete') continue;
      const [roomRow] = await tx.select().from(onlineRoomsTable)
        .where(eq(onlineRoomsTable.code, match.roomCode)).for('update');
      if (!roomRow) continue;
      const oldRoom = restoreOnlineRoom(roomRow.state);
      if (oldRoom.kumite?.tournamentId !== state.id || oldRoom.kumite?.matchId !== match.id)
        throw new Error('Kumite room receipt mismatch.');
      // A participant who reconnects directly to the assigned online room and
      // readies up has also checked in; the bracket does not depend on a UI path.
      match.checkedIn = [match.checkedIn[0] || oldRoom.members.player.ready,
        match.checkedIn[1] || !!oldRoom.members.cpu?.ready];
      const room = oldRoom.status === 'complete' ? oldRoom : expireOnlineRoom(oldRoom, now);
      match.startedAt = room.startedAt ?? null;
      match.completedAt = room.completedAt ?? null;
      match.durationMs = room.startedAt != null && room.completedAt != null ? Math.max(0, room.completedAt - room.startedAt) : null;
      if (room.revision !== oldRoom.revision) await tx.update(onlineRoomsTable).set({
        state: storeOnlineRoom(room), updatedAt: new Date(now),
        expiresAt: new Date(room.expiresAt),
      }).where(eq(onlineRoomsTable.id, roomRow.id));
      state = settleKumiteRoom(state, match.id, match.roomCode, room);
      await recordKumitePlayedRoom(tx, state, match, match.roomCode, room, now);
    }
    state = advanceKumite(state, now);
  }
  if (state.status === 'complete' && state.championId) {
    await recordKumiteChampion(tx, state, now);
    const champion = state.entrants.find(entry => entry.id === state.championId)!;
    await tx.insert(kumiteWinnersTable).values({ tournamentId: state.id, weekLabel: state.weekLabel,
      champion: { name: champion.member.name, hero: champion.member.deck.hero,
        avatarKey: champion.member.avatarKey, entrantCount: state.entrants.length }, wonAt: new Date(now),
    }).onConflictDoNothing();
  }
  if (JSON.stringify(state) !== JSON.stringify(row.state)) {
    await tx.update(kumiteTournamentsTable).set({ state: stored(state), updatedAt: new Date(now) })
      .where(eq(kumiteTournamentsTable.id, state.id));
  }
  return state;
}

async function currentTransaction<T>(action: (tx: Tx, state: KumiteState, now: number) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    // One short tournament lock serializes the capacity check, seeds, room issuance,
    // advancement and winner receipt, including separate serverless processes.
    await tx.execute(sql`select pg_advisory_xact_lock(72613408)`);
    const now = Date.now();
    const week = kumiteWeek(now);
    const previous = await tx.select().from(kumiteTournamentsTable).where(and(
      ne(kumiteTournamentsTable.id, week.id),
      sql`${kumiteTournamentsTable.state}->>'status' in ('registration', 'active')`,
    )).orderBy(asc(kumiteTournamentsTable.startsAt)).limit(12).for('update');
    await tx.insert(kumiteTournamentsTable).values({ id: week.id, state: stored(createKumite(now)),
      startsAt: new Date(week.startsAt), endsAt: new Date(week.endsAt),
    }).onConflictDoNothing();
    const [row] = await tx.select().from(kumiteTournamentsTable).where(eq(kumiteTournamentsTable.id, week.id)).for('update');
    // Reward writes lock profiles. Acquire every involved room first, then all
    // profiles in one global order to match existing online result settlement.
    // This avoids room/profile and cross-match deadlocks during concurrent polls.
    const states = [...previous, row].map(item => restore(item.state));
    const activeStates = states.filter(item =>
      item.status === 'active' || (item.status === 'registration' && now >= item.startsAt),
    );
    const codes = [...new Set(activeStates.flatMap(item => item.rounds.flat().flatMap(match => match.roomCode && match.status !== 'complete' ? [match.roomCode] : [])))];
    if (codes.length) await tx.select({ code: onlineRoomsTable.code }).from(onlineRoomsTable)
      .where(inArray(onlineRoomsTable.code, codes)).orderBy(asc(onlineRoomsTable.code)).for('update');
    const userIds = [...new Set(activeStates.flatMap(item => item.entrants.map(entry => entry.member.userId)))];
    if (userIds.length) await tx.select({ id: playerProfilesTable.clerkUserId }).from(playerProfilesTable)
      .where(inArray(playerProfilesTable.clerkUserId, userIds)).orderBy(asc(playerProfilesTable.clerkUserId)).for('update');
    for (const previousRow of previous) await refreshTournament(tx, previousRow, now);
    return action(tx, await refreshTournament(tx, row, now), now);
  });
}

export function currentKumite(userId: string | null) {
  return currentTransaction(async (tx, state, now) => currentView(tx, state, userId, now));
}
async function currentView(tx: Tx, state: KumiteState, userId: string | null, now: number) {
  const view = kumiteView(state, userId, now);
  if (userId) {
    await reconcileKumiteRewards(tx, userId, now);
    view.progression = await kumiteProgression(tx, userId);
  }
  const rows = await tx.select({ state: kumiteTournamentsTable.state }).from(kumiteTournamentsTable)
    .orderBy(desc(kumiteTournamentsTable.startsAt)).limit(52);
  const states = rows.map(row => restore(row.state));
  view.records = await recordCache.read(states, now, async () => {
    const codes = [...new Set(states.flatMap(item => item.rounds.flat().flatMap(match =>
      match.status === 'complete' && match.reason === 'played' && match.roomCode ? [match.roomCode] : [])))];
    const roomRows = codes.length ? await tx.select({ code: onlineRoomsTable.code, proof: kumiteRecordRoomProof })
      .from(onlineRoomsTable).where(inArray(onlineRoomsTable.code, codes)) : [];
    return buildKumiteRecords(states, new Map(roomRows.map(row => [row.code, row.proof])));
  });
  return view;
}
export function registerKumite(userId: string, deckId: string) {
  return currentTransaction(async (tx, state, now) => {
    const own = state.entrants.find(entry => entry.member.userId === userId);
    // Safe retry of the original registration, including after the bracket starts.
    if (own) {
      if (own.member.deck.id !== deckId) throw new OnlineError('Your Kumite gang is locked. Withdraw before choosing a different gang.');
      return currentView(tx, state, userId, now);
    }
    if (state.status !== 'registration' || now >= state.startsAt) throw new OnlineError('Registration has closed for this week.');
    if (state.entrants.length >= KUMITE_CAPACITY) throw new OnlineError('All eight Kumite places are filled.');
    const member = await loadMember(tx, userId, deckId, false);
    state.entrants.push({ id: randomUUID(), member, seed: null, registeredAt: now });
    await tx.update(kumiteTournamentsTable).set({ state: stored(state), updatedAt: new Date(now) })
      .where(eq(kumiteTournamentsTable.id, state.id));
    return currentView(tx, state, userId, now);
  });
}
export function withdrawKumite(userId: string) {
  return currentTransaction(async (tx, state, now) => {
    if (state.status !== 'registration' || now >= state.startsAt) throw new OnlineError('The bracket has started. Your entry is locked.');
    state.entrants = state.entrants.filter(entry => entry.member.userId !== userId);
    await tx.update(kumiteTournamentsTable).set({ state: stored(state), updatedAt: new Date(now) })
      .where(eq(kumiteTournamentsTable.id, state.id));
    return currentView(tx, state, userId, now);
  });
}
export function enterKumiteMatch(userId: string) {
  return currentTransaction(async (tx, state, now) => {
    const own = state.entrants.find(entry => entry.member.userId === userId);
    if (!own) throw new OnlineError('Sign up for this week before entering a bracket match.', 403);
    if (state.cancellationReason === 'rules-updated') return { room: null, current: await currentView(tx, state, userId, now) };
    if (state.status !== 'active') throw new OnlineError('Your weekly bracket is not active yet.');
    const match = state.rounds.flat().find(item => item.status !== 'complete' && item.entrantIds.includes(own.id));
    if (!match || match.status === 'pending') return { room: null, current: await currentView(tx, state, userId, now) };
    match.checkedIn[match.entrantIds[0] === own.id ? 0 : 1] = true;
    let room: OnlineRoom;
    if (match.roomCode) {
      const [row] = await tx.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, match.roomCode)).for('update');
      if (!row) throw new OnlineError('Could not reconnect to your bracket match. Please retry.', 503);
      room = restoreOnlineRoom(row.state);
    } else {
      const entries = match.entrantIds.map(id => state.entrants.find(entry => entry.id === id)!);
      room = joinOnlineRoom(createOnlineRoom(entries[0].member, randomInt(2) ? 'player' : 'cpu', now), entries[1].member, now);
      room.kumite = { tournamentId: state.id, matchId: match.id, roundDeadline: match.deadline };
      // Both assigned humans must ready up. Waiting lasts to the six-hour round cutoff.
      room.expiresAt = match.deadline;
      match.roomCode = randomBytes(6).toString('hex').toUpperCase();
      match.roomCodes.push(match.roomCode);
      match.startedAt = null; match.completedAt = null; match.durationMs = null;
      await tx.insert(onlineRoomsTable).values({ code: match.roomCode, hostUserId: entries[0].member.userId,
        guestUserId: entries[1].member.userId, createRequestId: randomUUID(),
        state: storeOnlineRoom(room), expiresAt: new Date(room.expiresAt),
      });
    }
    match.status = 'playing';
    await tx.update(kumiteTournamentsTable).set({ state: stored(state), updatedAt: new Date(now) })
      .where(eq(kumiteTournamentsTable.id, state.id));
    return { room: onlineRoomView(room, match.roomCode!, userId, now), current: await currentView(tx, state, userId, now) };
  });
}
export async function kumiteWinners() {
  // Reconcile a previously finished week before showing its immutable archive.
  await currentKumite(null);
  const rows = await db.select().from(kumiteWinnersTable).orderBy(desc(kumiteWinnersTable.wonAt)).limit(52);
  return { winners: rows.map(row => ({ tournamentId: row.tournamentId, weekLabel: row.weekLabel,
    ...row.champion, wonAt: row.wonAt.getTime() })), serverTime: Date.now() };
}
