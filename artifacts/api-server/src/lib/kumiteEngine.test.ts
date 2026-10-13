import assert from 'node:assert/strict';
import test from 'node:test';
import { applyOnlineCommand, createOnlineRoom, expireOnlineRoom, joinOnlineRoom, type OnlineMember } from '@workspace/squabblemon-engine/multiplayer';
import { ROOKIE_CORE_IDS, catalogIdsToEngineIds } from '@workspace/squabblemon-engine/data';
import { advanceKumite, createKumite, kumiteView, kumiteWeek, settleKumiteRoom, startKumite, type KumiteState } from './kumiteEngine';

const monday = Date.UTC(2026, 9, 12);
const member = (index: number): OnlineMember => ({ userId: `private-user-${index}`, name: `Fighter ${index}`, ready: false,
  deck: { id: `deck-${index}`, name: 'Locked gang', hero: 'hooper', cards: catalogIdsToEngineIds([...ROOKIE_CORE_IDS]) } });
function registered(count = 8) {
  const state = createKumite(monday);
  state.entrants = Array.from({ length: count }, (_, index) => ({ id: `entrant-${index}`, member: member(index), seed: null, registeredAt: monday }));
  return state;
}
function start(count = 8) {
  const state = registered(count);
  return startKumite(state, state.entrants.map(entry => entry.id), state.startsAt);
}
function win(state: KumiteState, matchId: string) {
  const next = structuredClone(state);
  const match = next.rounds.flat().find(item => item.id === matchId)!;
  const entries = match.entrantIds.map(id => next.entrants.find(entry => entry.id === id)!);
  match.roomCode = `ROOM-${matchId}`;
  let room = joinOnlineRoom(createOnlineRoom(entries[0].member, 'player', state.startsAt), entries[1].member, state.startsAt);
  room.kumite = { tournamentId: state.id, matchId, roundDeadline: match.deadline };
  room = applyOnlineCommand(room, 'cpu', { type: 'surrender' }, state.startsAt + 1);
  return advanceKumite(settleKumiteRoom(next, matchId, match.roomCode, room), state.startsAt + 1);
}

test('UTC weeks and eight seeds produce exactly seven games and three rounds', () => {
  assert.equal(kumiteWeek(Date.UTC(2026, 9, 18, 23, 59)).id, '2026-10-12');
  assert.equal(kumiteWeek(Date.UTC(2026, 9, 19)).id, '2026-10-19');
  const state = start();
  assert.deepEqual(state.rounds.map(round => round.length), [4, 2, 1]);
  assert.equal(new Date(state.startsAt).toISOString(), '2026-10-17T00:00:00.000Z');
  assert.equal(new Date(state.endsAt).toISOString(), '2026-10-17T18:00:00.000Z');
  assert.equal(new Set(state.rounds[0].flatMap(match => match.entrantIds)).size, 8);
  assert.throws(() => startKumite(registered(), ['entrant-0'], state.startsAt), /Invalid Kumite seeds/);
});

test('server room receipts advance winners exactly once through a real eight-person bracket', () => {
  let state = start();
  const ids = state.rounds.flat().map(match => match.id);
  for (const id of ids) state = win(state, id);
  assert.equal(state.status, 'complete');
  assert.equal(state.championId, 'entrant-0');
  assert.equal(state.rounds.flat().filter(match => match.reason === 'surrender').length, 7);
  assert.deepEqual(advanceKumite(state, state.endsAt + 1), state);
});

test('underfilled seats become distributed byes; no-shows never invent champions', () => {
  assert.equal(start(1).status, 'cancelled');
  const two = start(2);
  assert.equal(two.rounds[0].filter(match => match.reason === 'bye').length, 2);
  assert.equal(two.rounds[2][0].status, 'ready');
  assert.equal(advanceKumite(two, two.endsAt).status, 'cancelled');
  const state = start();
  state.rounds[0][0].checkedIn = [true, false];
  const expired = advanceKumite(state, state.rounds[0][0].deadline);
  assert.equal(expired.rounds[0][0].winnerId, state.rounds[0][0].entrantIds[0]);
  assert.equal(expired.rounds[0][1].winnerId, null);
  assert.equal(advanceKumite(start(), state.endsAt).championId, null);
});

test('public bracket hides private identities, locked decks, and other room codes', () => {
  const state = start();
  state.rounds[0][0].roomCode = 'SECRET';
  const guest = JSON.stringify(kumiteView(state, null, state.startsAt));
  assert(!guest.includes('private-user-'));
  assert(!guest.includes('deck-'));
  assert(!guest.includes('SECRET'));
  const own = kumiteView(state, 'private-user-0', state.startsAt);
  assert.equal(own.registration?.deckId, 'deck-0');
  assert.equal(own.currentMatch?.roomCode, 'SECRET');
});

test('turn deadlines and tournament cutoff are server enforced; draws replay, room substitutions fail', () => {
  const state = start();
  const match = state.rounds[0][0];
  match.roomCode = 'ISSUED';
  const entries = match.entrantIds.map(id => state.entrants.find(entry => entry.id === id)!);
  let room = joinOnlineRoom(createOnlineRoom(entries[0].member, 'player', state.startsAt), entries[1].member, state.startsAt);
  room.kumite = { tournamentId: state.id, matchId: match.id, roundDeadline: match.deadline };
  room = applyOnlineCommand(applyOnlineCommand(room, 'player', { type: 'ready' }, state.startsAt), 'cpu', { type: 'ready' }, state.startsAt);
  const timeout = expireOnlineRoom(room, room.deadline! + 1);
  assert.equal(timeout.reason, 'timeout');
  assert.equal(timeout.kumite?.finishedAt, room.deadline);
  assert.equal(settleKumiteRoom(state, match.id, 'ISSUED', timeout).rounds[0][0].winnerId, entries[1].id);
  assert.equal(expireOnlineRoom(timeout, match.deadline + 60_000).status, 'complete', 'issued completion receipt survives reconnect and lazy bracket settlement');
  assert.throws(() => applyOnlineCommand(timeout, 'player', { type: 'rematch' }, state.startsAt + 10), /Return to Kumite/);
  assert.throws(() => applyOnlineCommand(room, 'player', { type: 'end-turn' }, match.deadline), /deadline has passed/);
  assert.throws(() => settleKumiteRoom(state, match.id, 'ISSUED', { ...timeout, members: { ...timeout.members, cpu: member(99) } }), /participants/);
  const drawn = { ...timeout, winner: 'draw' as const, reason: 'districts' as const };
  const replay = settleKumiteRoom(state, match.id, 'ISSUED', drawn);
  assert.equal(replay.rounds[0][0].status, 'ready');
  assert.equal(replay.rounds[0][0].roomCode, null);
  assert.equal(replay.rounds[0][0].winnerId, null);
});
