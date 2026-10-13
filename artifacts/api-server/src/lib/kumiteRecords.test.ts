import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOKIE_CORE_IDS, catalogIdsToEngineIds } from '@workspace/squabblemon-engine/data';
import { DISTRICT_CATALOG, getLegalCardCost, validateDistrictSnapshot, type Lane } from '@workspace/squabblemon-engine/gameEngine';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, type OnlineMember, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { advanceKumite, createKumite, settleKumiteRoom, startKumite, type KumiteState } from './kumiteEngine';
import { buildKumiteRecords, createKumiteRecordCache } from './kumiteRecords';

function playedFinal(week: number, durationStep: number, winnerUser = 'private-winner') {
  const monday = Date.UTC(2026, 9, 12 + week * 7);
  const member = (userId: string): OnlineMember => ({ userId, name: userId === winnerUser ? 'Actual Fighter' : 'Actual Rival', ready: false,
    deck: { id: 'private-deck', name: 'Locked gang', hero: 'hooper', cards: catalogIdsToEngineIds([...ROOKIE_CORE_IDS]) } });
  let state = createKumite(monday);
  state.entrants = [winnerUser, `private-rival-${week}`].map((userId, index) => ({ id: `entrant-${index}`, member: member(userId),
    registeredAt: monday, seed: null }));
  state = startKumite(state, state.entrants.map(entry => entry.id), state.startsAt);
  const match = state.rounds[2][0], code = `private-room-${week}`;
  match.roomCode = code; match.roomCodes = [code];
  const host = state.entrants.find(entry => entry.id === match.entrantIds[0])!;
  const guest = state.entrants.find(entry => entry.id === match.entrantIds[1])!;
  let now = state.startsAt;
  let room = joinOnlineRoom(createOnlineRoom(host.member, 'player', now), guest.member, now);
  room.kumite = { tournamentId: state.id, matchId: match.id, roundDeadline: match.deadline };
  room = applyOnlineCommand(applyOnlineCommand(room, 'player', { type: 'ready' }, now), 'cpu', { type: 'ready' }, now);
  room.match = { ...room.match!, districtSnapshot: validateDistrictSnapshot({ version: 1,
    locations: ['bodega', 'vip-section', 'underground-ring'].map(id => DISTRICT_CATALOG.find(location => location.id === id)!) }) };
  while (room.status === 'active') {
    const seat = room.activeSeat, lane = ((room.match!.round - 1) % 3) as Lane;
    if (seat === 'player') {
      const card = room.match!.playerHand.find(card => getLegalCardCost(room.match!, seat, card, lane) <= room.match!.playerMotion);
      if (card) room = applyOnlineCommand(room, seat, { type: 'play', instanceId: card.instanceId, lane, squabble: false }, now += durationStep);
    }
    room = applyOnlineCommand(room, seat, { type: 'end-turn' }, now += durationStep);
  }
  assert.equal(room.reason, 'districts'); assert.equal(room.winner, 'player');
  state = advanceKumite(settleKumiteRoom(state, match.id, code, room), now);
  return { state, code, room };
}

test('public records use actual full-battle dates, times and winners without exposing identities or room codes', () => {
  const older = playedFinal(0, 2_000), faster = playedFinal(1, 1_000);
  const records = buildKumiteRecords([faster.state, older.state], new Map([[older.code, older.room], [faster.code, faster.room]]));
  assert.equal(records.fastestFight!.durationMs, faster.room.completedAt! - faster.room.startedAt!);
  assert.equal(records.fastestFight!.completedAt, faster.room.completedAt);
  assert.equal(records.fastestFight!.winner.name, 'Actual Fighter');
  assert.deepEqual(records.recentWinners.map(winner => winner.tournamentId), [faster.state.id, older.state.id]);
  assert.deepEqual(records.handThrowers.map(entry => [entry.rank, entry.playedWins, entry.championships]), [[1, 2, 2]]);
  assert(!JSON.stringify(records).includes('private-'));
  const substituted = { ...faster.room, members: { ...faster.room.members, cpu: { ...faster.room.members.cpu!, userId: 'outsider' } } };
  assert.equal(buildKumiteRecords([faster.state], new Map([[faster.code, substituted]])).fastestFight, null);
  for (const reason of ['surrender', 'timeout'] as const) assert.equal(buildKumiteRecords([faster.state],
    new Map([[faster.code, { ...faster.room, reason }]])).handThrowers.length, 0);
  assert.equal(buildKumiteRecords([faster.state], new Map([[faster.code,
    { ...faster.room, kumite: { ...faster.room.kumite!, finishedAt: faster.state.endsAt + 1 } }]])).fastestFight, null);
  for (const patch of [
    { startedAt: Number.NaN }, { completedAt: Number.POSITIVE_INFINITY },
    { startedAt: faster.state.startsAt - 1 },
    { kumite: { ...faster.room.kumite!, roundDeadline: faster.state.endsAt + 1 } },
  ]) assert.equal(buildKumiteRecords([faster.state], new Map([[faster.code, { ...faster.room, ...patch }]])).fastestFight, null);
});

test('recent records are bounded to 52 tournaments and 10 winners/leaders; ranking counts actual wins', () => {
  const base = playedFinal(0, 1_000);
  const states: KumiteState[] = [], rooms = new Map<string, OnlineRoom>();
  for (let i = 0; i < 53; i++) {
    // Vary frozen identities and timestamps of the already engine-completed review battle.
    const state = structuredClone(base.state), room = structuredClone(base.room), code = `record-room-${i}`;
    state.id = `record-week-${i}`; state.entrants[0].member.userId = `record-player-${i}`;
    state.entrants[0].member.name = `Fighter ${i}`; state.rounds[2][0].roomCode = code;
    room.members.player = state.entrants[0].member; room.kumite!.tournamentId = state.id;
    states.push(state); rooms.set(code, room);
  }
  const records = buildKumiteRecords(states, rooms);
  assert.equal(records.recentWinners.length, 10); assert.equal(records.handThrowers.length, 10);
  assert(records.handThrowers.every(entry => entry.playedWins === 1 && entry.championships === 1));
  assert(!JSON.stringify(records).includes('record-week-52'));
  const empty = buildKumiteRecords([], new Map());
  assert.deepEqual([empty.fastestFight, empty.recentWinners, empty.handThrowers], [null, [], []]);
});

test('record cache reuses unchanged polls, immediately refreshes settlements and does not share mutable records', async () => {
  const older = playedFinal(0, 2_000), faster = playedFinal(1, 1_000);
  const cache = createKumiteRecordCache();
  const rooms = new Map([[older.code, older.room], [faster.code, faster.room]]);
  let reads = 0;
  const load = async (states: KumiteState[]) => { reads++; return buildKumiteRecords(states, rooms); };
  const states = [older.state];
  const first = await cache.read(states, 0, () => load(states));
  first.handThrowers[0].name = 'mutated caller';
  first.recentWinners.length = 0;
  for (const now of [2_500, 5_000, 10_000, 14_999]) {
    const result = await cache.read(states, now, () => load(states));
    assert.equal(result.handThrowers[0].name, 'Actual Fighter');
    assert.equal(result.recentWinners.length, 1);
    assert(!JSON.stringify(result).includes('private-'));
  }
  assert.equal(reads, 1, 'unchanged polls avoid historical room reads');
  const updated = [faster.state, older.state];
  const settled = await cache.read(updated, 14_999, () => load(updated));
  assert.equal(reads, 2); assert.equal(settled.recentWinners.length, 2);
  assert.equal(settled.fastestFight!.completedAt, faster.room.completedAt);
  const renamed = structuredClone(updated);
  renamed[0].entrants[0].member.name = 'New frozen presentation';
  const presentation = await cache.read(renamed, 15_000, () => load(renamed));
  assert.equal(reads, 3);
  assert.equal(presentation.fastestFight!.winner.name, 'New frozen presentation');
  await cache.read(renamed, 30_000, () => load(renamed));
  assert.equal(reads, 4, 'a warm worker revalidates proofs when the 15-second TTL expires');
  await cache.read(states, 30_001, () => load(states));
  await cache.read(renamed, 30_002, () => load(renamed));
  assert.equal(reads, 6, 'only one snapshot is retained; prior keys are not accumulated');
});
