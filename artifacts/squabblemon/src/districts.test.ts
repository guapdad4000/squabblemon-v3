import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAbilityUpgradeSnapshot, DISTRICT_CATALOG, createDistrictSnapshot, validateDistrictSnapshot, createMatch, createCardInstance,
  getDistrictResults, getDistrictCardBonusForMatch, getMatchDistricts, getLegalCardCost, getCardCostExplanation, nextRound,
  playTurnCard, pass, revealCpuTurn, verifyMatchTranscript, createStoryMatch, verifyStoryMatchTranscript,
  type DistrictId, type DistrictSnapshot, type Match, type Lane, type Owner, type PlayerMove,
} from './gameEngine';
import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import { previewBattlePlay } from './battlePreview';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView, type OnlineMember } from '@workspace/squabblemon-engine/multiplayer';
import { decks } from './data';

const snapshot = (...ids: [DistrictId, DistrictId, DistrictId]): DistrictSnapshot => ({
  version: 1, locations: ids.map(id => ({ ...DISTRICT_CATALOG.find(d => d.id === id)! })) as DistrictSnapshot['locations'],
});
const initial = (...ids: [DistrictId, DistrictId, DistrictId]) => createMatch('vibes', 'vibes', undefined, undefined, snapshot(...ids));
const card = (id: string, owner: Owner = 'player', index = 0, lane: Lane | null = null) => ({ ...createCardInstance(id, owner, 'district-test', index), lane });
function play(match: Match, id: string, lane: Lane, owner: Owner = 'player', index = match.nextEventSequence) {
  const entry = card(id, owner, index);
  return playTurnCard({ ...match, phase: owner === 'player' ? 'player' : 'cpu-reveal', [owner === 'player' ? 'playerHand' : 'cpuHand']: [entry], [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 20 }, owner, entry.instanceId, lane);
}
const advance = (match: Match) => nextRound({ ...match, phase: 'resolved' });

test('district draw is deterministic, includes all sixteen, has no duplicates, and copies definitions', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const result = createDistrictSnapshot(`match-${i}`);
    assert.deepEqual(result, createDistrictSnapshot(`match-${i}`));
    assert.equal(new Set(result.locations.map(d => d.id)).size, 3);
    result.locations.forEach(d => seen.add(d.id));
  }
  assert.equal(seen.size, 16);
  const source = snapshot('bodega', 'penthouse', 'county-jail');
  const m = createMatch('vibes', 'vibes', undefined, undefined, source);
  source.locations[0].name = 'Changed outside match';
  assert.equal(getMatchDistricts(m)[0].name, 'BODEGA');
  assert.throws(() => validateDistrictSnapshot({ version: 2, locations: [] }), /outdated/);
  assert.throws(() => validateDistrictSnapshot(snapshot('bodega', 'bodega', 'penthouse')), /outdated/);
});

test('Bodega discount is per side, first play only, bounded and non-stacking with taxes applied afterward', () => {
  let m = initial('bodega', 'time-square', 'magic-city');
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost - 1);
  assert.equal(getLegalCardCost(m, 'player', card('cornball'), 0), 1);
  assert.match(getCardCostExplanation(m, 'player', card('hooper'), 0), /Bodega/);
  m = { ...m, discountTokens: [{ id: 'token', owner: 'player', sourceInstanceId: 'plug', eligibility: 'any', sourceLane: 1, createdOrder: 1 }] };
  m.boards[0] = [card('landlord', 'cpu', 0, 0)];
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost, 'one discount and one tax');
  m = play(m, 'hooper', 0);
  assert.equal(m.discountTokens.length, 0);
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost, 'discount and first-play tax both consumed');
  assert.equal(getLegalCardCost(m, 'cpu', card('hooper', 'cpu'), 0), card('hooper').cost - 1, 'rival keeps their own discount');
  m.boards[0] = [];
  assert.equal(getLegalCardCost(advance(m), 'player', card('hooper'), 0), card('hooper').cost, 'leaving and a new round do not reset it');
});

test('The Trap rewards actual movement once per card, never direct deployment or repeated entry', () => {
  let m = initial('the-trap', 'time-square', 'magic-city');
  m.boards[2] = [{ ...card('og', 'player', 99, 2), basePower: 20 }];
  m = play(m, 'bikelife', 1);
  const rider = m.boards[0][0];
  assert.equal(rider.cardId, 'bikelife');
  assert.equal(rider.powerModifier, 3, 'Ride Out +1 and Trap +2');
  assert.match(m.effectLog.at(-1)!.note, /THE TRAP/);
  m = play(m, 'vibe', 2);
  assert(m.boards[2].some(c => c.instanceId === rider.instanceId));
  m.boards[2] = m.boards[2].map(c => c.instanceId === rider.instanceId ? c : { ...c, basePower: 30 });
  m = play(m, 'vibe', 0);
  assert.equal(m.boards[0].find(c => c.instanceId === rider.instanceId)!.powerModifier, 5, 'two Wave Checks, no second Trap reward');
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 0);
  assert.deepEqual(m.districtRuntime!.trappedCardIds, [rider.instanceId]);
});

test('Waff-L House freezes comeback eligibility before either side acts and resets first plays each round', () => {
  let m = initial('waff-l-house', 'time-square', 'magic-city');
  m.boards[0] = [card('og', 'cpu', 99, 0)];
  m = advance(m);
  assert.equal(m.districtRuntime!.trailing.player[0], true);
  assert.equal(m.districtRuntime!.trailing.cpu[0], false);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 2);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 0);
  m = play(m, 'cornball', 0, 'cpu');
  assert.equal(m.boards[0].at(-1)!.powerModifier, 0);
  m = advance(m);
  assert.equal(m.districtRuntime!.roundPlays.player[0], 0);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 2);
  let tied = initial('waff-l-house', 'bodega', 'magic-city');
  tied = play(tied, 'cornball', 0, 'cpu');
  tied = play(tied, 'cornball', 0);
  assert.equal(tied.boards[0].at(-1)!.powerModifier, 0, 'falling behind mid-round does not qualify');
});

test('VIP Section uses printed cost, follows occupancy, and grants no bonus to frozen cards', () => {
  const m = initial('vip-section', 'time-square', 'magic-city');
  const big = card('hooper', 'player', 0, 0);
  m.boards[0] = [big];
  assert.equal(getDistrictResults(m)[0].player, big.basePower + 2);
  m.boards[0][0] = { ...big, statuses: { ...big.statuses, silenced: true } };
  assert.equal(getDistrictResults(m)[0].player, big.basePower + 2);
  m.boards[0][0] = { ...big, statuses: { ...big.statuses, frozen: true } };
  assert.equal(getDistrictResults(m)[0].player, 0);
  m.boards[0] = []; m.boards[1] = [{ ...big, lane: 1 }];
  assert.equal(getDistrictResults(m)[1].player, big.basePower);
});

test('County Jail stops first-arrival self movement and pulls, with no movement-linked buffs', () => {
  let m = initial('county-jail', 'time-square', 'the-trap');
  m = play(m, 'bikelife', 0);
  const prisoner = m.boards[0][0];
  assert.equal(prisoner.powerModifier, 0);
  assert.equal(prisoner.moved, false);
  assert.match(m.effectLog.at(-1)!.note, /COUNTY JAIL held/);
  m = play(m, 'vibe', 1);
  assert.equal(m.boards[0][0].instanceId, prisoner.instanceId);
  assert.equal(m.boards[1][0].powerModifier, 0);
  m = play(m, 'carmeet', 0);
  assert(m.boards[2].some(c => c.cardId === 'carmeet'), 'second arrival can leave');
  m = play(m, 'bikelife', 0, 'cpu');
  assert.equal(m.districtRuntime!.detainedCardIds.length, 2, 'one first arrival per side');
  assert(m.boards[0].some(c => c.owner === 'cpu'));
});

test('Penthouse changes once at round four and replay frames preserve both score rules', () => {
  let m = initial('penthouse', 'time-square', 'bodega');
  m.boards[0] = [card('cornball', 'player', 0, 0)];
  assert.equal(getDistrictResults(m)[0].player, 4);
  m = { ...m, round: 3 };
  m = advance(m);
  assert.equal(getDistrictResults(m)[0].player, 2);
  const boundary = m.effectLog.find(e => e.type === 'round-start')!;
  assert.equal(getDistrictResults({ ...m, ...boundary.replay.before })[0].player, 4);
  assert.equal(getDistrictResults({ ...m, ...boundary.replay.after })[0].player, 2);
  assert.match(m.effectLog.at(-1)!.note, /party starts/);
  m.boards[0].push(card('cornball', 'player', 1, 0));
  assert.equal(getDistrictResults(m)[0].player, 4);
  assert.equal(getDistrictResults(advance(m))[0].player, 4, 'crew bonus does not accumulate');
});

test('Time Square adds a single reversible side bonus for three distinct types', () => {
  const m = initial('time-square', 'vip-section', 'bodega');
  m.boards[0] = [card('cornball', 'player', 0, 0), card('bikelife', 'player', 1, 0), card('hooper', 'player', 2, 0)];
  const base = m.boards[0].reduce((n, c) => n + c.basePower, 0);
  assert.equal(getDistrictResults(m)[0].player, base + 3);
  m.boards[0].push(card('cornball', 'player', 3, 0));
  assert.equal(getDistrictResults(m)[0].player, base + 4);
  m.boards[0] = m.boards[0].filter(c => c.cardId !== 'hooper');
  assert.equal(getDistrictResults(m)[0].player, base + 1 - card('hooper').basePower, 'removing the third type removes the bonus');
});

test('Magic City rewards only the first play per side in rounds five and six', () => {
  let m = { ...initial('magic-city', 'time-square', 'bodega'), round: 4 };
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 0);
  m = advance(m);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 2);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 0);
  m = play(m, 'cornball', 0, 'cpu');
  assert.equal(m.boards[0].at(-1)!.powerModifier, 2);
  m = play(advance(m), 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 2);
});

function finish(initialMatch: Match) {
  let m = initialMatch;
  const moves: PlayerMove[] = [];
  while (m.phase !== 'complete') {
    for (const entry of [...m.playerHand]) {
      const target = ([0, 1, 2] as Lane[]).find(l => getLegalCardCost(m, 'player', entry, l) <= m.playerMotion);
      if (target === undefined) continue;
      moves.push({ cardInstanceId: entry.instanceId, lane: target, squabble: false, endTurn: false });
      const preview = previewBattlePlay(m, entry.instanceId, target)!;
      m = playTurnCard(m, 'player', entry.instanceId, target);
      assert.deepEqual(preview.after, getDistrictResults(m));
    }
    moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
    m = nextRound(revealCpuTurn(pass(m, 'player')));
  }
  return { m, moves };
}

test('new district matches reproduce full CPU turns, previews, scores, and runtime in reward replay', () => {
  for (const ids of [['bodega', 'penthouse', 'waff-l-house'], ['the-trap', 'county-jail', 'vip-section'], ['magic-city', 'time-square', 'penthouse'], ['the-subway', 'the-trap', 'o-block'], ['hollywood-strip', 'dive-bar', 'acorn-projects'], ['corrupt-church', 'nail-salon', 'barbershop']] as [DistrictId, DistrictId, DistrictId][]) {
    const start = initial(...ids), { m, moves } = finish(start);
    const verified = verifyMatchTranscript('vibes', 'vibes', moves, start.abilityUpgradeSnapshot, undefined, start.districtSnapshot);
    assert.deepEqual(verified, m);
  }
});

test('story matches replay the exact issued locations alongside encounter modifiers', () => {
  const encounter = getStoryBattle('cracked-head-takes-the-block')!.encounter;
  const locations = snapshot('bodega', 'penthouse', 'waff-l-house');
  const start = createStoryMatch(encounter, 'vibes', undefined, undefined, locations);
  const { m, moves } = finish(start);
  assert.deepEqual(verifyStoryMatchTranscript(encounter, 'vibes', moves, undefined, start.abilityUpgradeSnapshot, locations), m);
});

test('online players receive the same locations with seat-specific status and no private state', () => {
  const deck = decks.find(d => d.id === 'vibes')!;
  const member = (userId: string): OnlineMember => ({ userId, name: userId, ready: false, deck: { ...deck } });
  let room = joinOnlineRoom(createOnlineRoom(member('host'), 'player', 1000), member('guest'), 1001);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, 1002);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 1003);
  const host = onlineRoomView(room, 'ROOM', 'host', 1004), guest = onlineRoomView(room, 'ROOM', 'guest', 1004);
  assert.equal(host.districts.length, 3);
  assert.deepEqual(host.districts.map(d => d.id), guest.districts.map(d => d.id));
  assert.equal('districtRuntime' in host, false);
  assert.equal('cpuHand' in host, false);
});
test('persisted JSONB district effects accept reordered keys but reject changed rules', () => {
  for (const definition of DISTRICT_CATALOG) {
    const others = DISTRICT_CATALOG.filter(item => item.id !== definition.id).slice(0, 2);
    const snapshot = { version: 1, locations: [definition, ...others].map(item => ({
      ...item, effect: Object.fromEntries(Object.entries(item.effect).reverse()),
    })) };
    assert.doesNotThrow(() => validateDistrictSnapshot(snapshot));
    const forged = structuredClone(snapshot);
    forged.locations[0].effect.kind = 'forged';
    assert.throws(() => validateDistrictSnapshot(forged), /outdated/);
    const extra = structuredClone(snapshot);
    extra.locations[0].effect.extraPower = 99;
    assert.throws(() => validateDistrictSnapshot(extra), /outdated/);
  }
});


test('Subway resolves abilities before one ride per side per round, including wraparound and Trap arrivals', () => {
  let m = play(initial('the-subway', 'the-trap', 'county-jail'), 'cornball', 0);
  assert.equal(m.boards[0].length, 0);
  assert.equal(m.boards[1][0].powerModifier, 2);
  const ride = m.effectLog.at(-1)!;
  assert.match(ride.note, /THE SUBWAY.*THE TRAP/);
  assert.equal(ride.kind, 'move');
  assert.equal(ride.replay.before.boards[0].length, 1);
  assert.equal(ride.replay.after.boards[1].length, 1);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].length, 1, 'second play stays');
  m = play(m, 'cornball', 0, 'cpu');
  assert.equal(m.boards[1].filter(c => c.owner === 'cpu').length, 1);
  m = play(advance(m), 'cornball', 0);
  assert.equal(m.boards[1].filter(c => c.owner === 'player').length, 2);
  const wrap = play(initial('county-jail', 'the-trap', 'the-subway'), 'cornball', 2);
  assert.equal(wrap.boards[0].length, 1);
  assert.equal(wrap.districtRuntime!.detainedCardIds.length, 0, 'moving in is not a direct play');
  const rider = play(initial('the-subway', 'bodega', 'the-trap'), 'bikelife', 0);
  assert.equal(rider.boards[1][0].powerModifier, 1);
  assert.equal(rider.effectLog.filter(e => e.note.startsWith('THE SUBWAY:')).length, 0, 'already departed: no second ride');
});

test('O-Block flips with occupancy; penalties stop at zero and frozen cards stay zero', () => {
  const m = initial('o-block', 'bodega', 'the-trap');
  const own = card('cornball', 'player', 0, 0), rival = card('hooper', 'cpu', 0, 0);
  m.boards[0] = [own];
  assert.equal(getDistrictResults(m)[0].player, 3);
  m.boards[0].push(rival);
  assert.equal(getDistrictResults(m)[0].player, 1);
  m.boards[0].push(card('cornball', 'cpu', 1, 0));
  assert.equal(getDistrictResults(m)[0].player, 0);
  assert.equal(getDistrictResults(m)[0].cpu, rival.basePower + 1 + 4);
  m.boards[0] = [{ ...own, statuses: { ...own.statuses, frozen: true } }];
  assert.equal(getDistrictResults(m)[0].player, 0);
  assert.equal(own.powerModifier, 0);
});

test('Hollywood spotlight follows newest friendly arrivals, including moves, and falls back when they leave', () => {
  let m = play(initial('hollywood-strip', 'bodega', 'the-trap'), 'cornball', 0);
  const first = m.boards[0][0];
  m = play(m, 'cornball', 0);
  const second = m.boards[0][1];
  assert.equal(getDistrictCardBonusForMatch(m, first, 0), -1);
  assert.equal(getDistrictCardBonusForMatch(m, second, 0), 3);
  m.boards[0].push(card('hooper', 'cpu', 90, 0));
  assert.equal(getDistrictCardBonusForMatch(m, second, 0), 3);
  m.boards[0] = [first];
  assert.equal(getDistrictCardBonusForMatch(m, first, 0), 3);
  m.boards[2] = [{ ...card('og', 'player', 91, 2), basePower: 20 }];
  m = play(m, 'bikelife', 1);
  assert.equal(m.boards[0].at(-1)!.cardId, 'bikelife');
  assert.equal(getDistrictCardBonusForMatch(m, first, 0), -1);
});

test('Dive Bar discounts every play without stacking; moving out removes only its scoring penalty', () => {
  let m = initial('dive-bar', 'bodega', 'the-trap');
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost - 1);
  assert.equal(getLegalCardCost(m, 'player', card('cornball'), 0), 1);
  assert.match(getCardCostExplanation(m, 'player', card('hooper'), 0), /Dive Bar/);
  m.discountTokens = [{ id: 'discount', owner: 'player', sourceInstanceId: 'plug', eligibility: 'any', sourceLane: 1, createdOrder: 1 }];
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost - 1);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].length, 1, 'zero contribution does not destroy cards');
  assert.equal(getDistrictResults(m)[0].player, 0);
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost - 1);
  const entry = m.boards[0][0];
  m = play(m, 'vibe', 1);
  const moved = m.boards[1].find(c => c.instanceId === entry.instanceId)!;
  assert.equal(getDistrictCardBonusForMatch(m, moved, 1), 0);
  assert.equal(moved.powerModifier, 1, 'only Wave Check is permanent');
});

test('Acorn Projects scales cheap printed costs with friendly occupancy, capped at three', () => {
  const m = initial('acorn-projects', 'bodega', 'the-trap');
  const cheap = card('cornball', 'player', 0, 0), big = card('hooper', 'player', 1, 0);
  m.boards[0] = [cheap, big, card('cornball', 'cpu', 0, 0)];
  assert.equal(getDistrictCardBonusForMatch(m, cheap, 0), 1);
  assert.equal(getDistrictCardBonusForMatch(m, big, 0), 0);
  for (let i = 2; i < 7; i++) m.boards[0].push(card('cornball', 'player', i, 0));
  assert.equal(getDistrictCardBonusForMatch(m, cheap, 0), 3);
  m.boards[0] = [cheap];
  assert.equal(getDistrictCardBonusForMatch(m, cheap, 0), 0);
});

test('Corrupt Church charges and buffs first plays per side and round, after discounts and Rent Due', () => {
  let m = initial('corrupt-church', 'bodega', 'the-trap');
  const entry = card('cornball');
  assert.equal(getLegalCardCost(m, 'player', entry, 0), 2);
  assert.match(getCardCostExplanation(m, 'player', entry, 0), /Corrupt Church tithe/);
  assert.throws(() => playTurnCard({ ...m, playerHand: [entry], playerMotion: 1 }, 'player', entry.instanceId, 0), /Motion/);
  m.boards[0] = [card('landlord', 'cpu', 90, 0)];
  m.discountTokens = [{ id: 'discount', owner: 'player', sourceInstanceId: 'plug', eligibility: 'any', sourceLane: 1, createdOrder: 1 }];
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost + 1);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 2);
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 0);
  m = play(m, 'cornball', 0, 'cpu');
  assert.equal(m.boards[0].at(-1)!.powerModifier, 2);
  m = advance(m);
  assert.equal(getLegalCardCost(m, 'player', card('hooper'), 0), card('hooper').cost + 2);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.powerModifier, 2);
});

test('Nail Salon protects first arrivals once, follows movement, and blocks hostile displacement', () => {
  let m = play(initial('nail-salon', 'bodega', 'the-trap'), 'hooper', 0);
  const target = m.boards[0][0].instanceId;
  m = play(m, 'snow', 0, 'cpu');
  assert.equal(m.boards[0].find(c => c.instanceId === target)!.statuses.frozen, false);
  assert.match(m.effectLog.at(-1)!.note, /NAIL SALON blocked/);
  assert.equal(m.timedEffects.filter(e => e.kind === 'salon-protection' && e.owner === 'player').length, 0);
  m = play(m, 'nerd', 0, 'cpu');
  assert.equal(m.boards[0].find(c => c.instanceId === target)!.statuses.silenced, true);
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.statuses.protected, false);
  m = play(advance(m), 'cornball', 0);
  assert.equal(m.boards[0].at(-1)!.statuses.protected, true);
  let riding = play(initial('nail-salon', 'bodega', 'the-trap'), 'bikelife', 0);
  assert.equal(riding.boards[1][0].statuses.protected, true);
  riding = play(riding, 'roaster', 1, 'cpu');
  assert.equal(riding.boards[1][0].powerModifier, 1);
  let shoved = play(initial('nail-salon', 'bodega', 'the-trap'), 'cornball', 0);
  const shielded = shoved.boards[0][0].instanceId;
  shoved.boards[0].push(card('hooper', 'player', 90, 0), card('og', 'player', 91, 0));
  shoved = play(shoved, 'cornball', 0, 'cpu');
  assert(shoved.boards[0].some(c => c.instanceId === shielded));
  shoved = play(shoved, 'cornball', 0, 'cpu');
  assert(shoved.boards[1].some(c => c.instanceId === shielded));
});

test('Barbershop cleans allies before reveal, preserves buffs and opponents, and resets each round', () => {
  let m = initial('barbershop', 'bodega', 'the-trap');
  const hurt = { ...card('hooper', 'player', 80, 0), powerModifier: -2, statuses: { frozen: true, silenced: true, protected: false, blocked: false } };
  const buffed = { ...card('og', 'player', 81, 0), powerModifier: 3 };
  const enemy = { ...card('hooper', 'cpu', 82, 0), powerModifier: -1, statuses: { ...hurt.statuses } };
  m.boards[0] = [hurt, buffed, enemy];
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0][0].powerModifier, 0);
  assert.equal(m.boards[0][0].statuses.frozen, false);
  assert.equal(m.boards[0][0].statuses.silenced, false);
  assert.equal(m.boards[0][1].powerModifier, 3);
  assert.deepEqual(m.boards[0][2], enemy);
  const cleanup = m.effectLog.find(e => e.note.startsWith('BARBERSHOP:'))!;
  assert.equal(cleanup.replay.before.boards[0][0].statuses.frozen, true);
  assert.equal(cleanup.replay.after.boards[0][0].statuses.frozen, false);
  assert(cleanup.sequence < m.effectLog.at(-1)!.sequence);
  m.boards[0][0] = hurt;
  m = play(m, 'cornball', 0);
  assert.equal(m.boards[0][0].statuses.frozen, true);
  m = play(advance(m), 'cornball', 0);
  assert.equal(m.boards[0][0].statuses.frozen, false);
});


test('Nail Salon also blocks attack upgrades and keeps Wifey protection independent', () => {
  let m = play(initial('nail-salon', 'bodega', 'the-trap'), 'hooper', 0);
  m = { ...m, abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(['hooper'], ['roaster'], { cpu: { roaster: { xp: 4500, level: 10, moveTier: 3 } } }) };
  assert(m.abilityUpgradeSnapshot.cpu[0].upgradeIds.length > 0, 'attacker has trained upgrades');
  const start = m.nextEventSequence;
  m = play(m, 'roaster', 0, 'cpu');
  assert.equal(m.boards[0][0].powerModifier, 0);
  assert.equal(m.effectLog.filter(e => e.sequence >= start && e.abilityMetadata).length, 0);
  let guarded = play(initial('nail-salon', 'bodega', 'the-trap'), 'wifey', 0);
  guarded = play(guarded, 'snow', 0, 'cpu');
  assert.equal(guarded.boards[0][0].statuses.protected, true);
  assert.equal(guarded.boards[0][0].statuses.frozen, false);
  guarded = play(guarded, 'snow', 0, 'cpu');
  assert.equal(guarded.boards[0][0].statuses.frozen, false, 'Side Eye blocks independently after salon shield');
  guarded = play(guarded, 'snow', 0, 'cpu');
  assert.equal(guarded.boards[0][0].statuses.frozen, true);
});
