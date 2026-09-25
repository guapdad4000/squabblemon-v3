import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardById, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, playCard, playTurnCard, nextRound, getEffectiveCardPower, getLegalCardCost, getCardCostExplanation, type CardInstance, type Match, type Owner, type Lane } from './gameEngine';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';

const unit = (id: string, owner: Owner, lane: Lane, index: number, power = 10): CardInstance =>
  ({ ...createCardInstance(id, owner, 'buddy-folks', index), lane, basePower: power, power });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
function setup(id: 'buddy' | 'folks', owner: Owner = 'player') {
  const source = createCardInstance(id, owner, 'duo', 0);
  const m: Match = { ...createMatch('block', 'combo'), round: 4, phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 9, cpuMotion: 9, playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [], squabbleByOwner: { player: false, cpu: false } };
  return { source, m, enemy: owner === 'player' ? 'cpu' as const : 'player' as const };
}
function protect(m: Match, card: CardInstance, kind: 'church-protection' | 'nail-mitigation' = 'church-protection') {
  card.statuses.protected = kind === 'church-protection';
  m.timedEffects.push({ id: 'protection:' + card.instanceId, kind, owner: card.owner, lane: card.lane!, sourceInstanceId: 'protector', targetInstanceId: card.instanceId, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' });
}

test('BUDDY is a Legendary Earth character with a distinct normal and Squabble contract', () => {
  for (const id of ['buddy', 'folks'] as const) {
    assert.equal(catalogCardById[id].rarity, 'Legendary');
    assert.deepEqual(catalogCardById[id].acquisitionSources, ['Street Packs']);
  }
  assert.deepEqual([cards.buddy.cost, cards.buddy.power, cards.folks.cost, cards.folks.power], [3, 4, 4, 3]);
  assert.equal(cards.buddy.type, 'Earth');
  assert.equal(cards.buddy.ability, 'Buddy Buds');
  assert.equal(cards['buddy-bud'], undefined, 'Bud tokens are battle-only and never collectible');
  assert.match(cards.buddy.effect, /two or three randomly chosen/);
  assert.match(cards.buddy.effect, /last eligible friendly character/);
  assert.match(cards.buddy.effect, /no eligible friendly recipient/);
  validateCardAbilityUpgrades({ buddy: cards.buddy, folks: cards.folks });
});
for (const owner of ['player', 'cpu'] as const) test('normal Buddy selects two or three eligible Bud lanes deterministically and discounts its lane for ' + owner, () => {
  const { m, source } = setup('buddy', owner);
  const original = JSON.stringify(m);
  const one = playCard(m, owner, source.instanceId, 0);
  const two = playCard(m, owner, source.instanceId, 0);
  const budLanes = (match: Match) => match.boards.flatMap((laneCards, laneIndex) =>
    laneCards.some(card => card.buddyBud) ? [laneIndex] : []);
  assert.deepEqual(budLanes(one), budLanes(two), 'selection depends only on replayable match state');
  assert.ok(budLanes(one).length === 2 || budLanes(one).length === 3);
  assert.equal(JSON.stringify(m), original, 'resolution does not mutate its input');
  const card = createCardInstance('hooper', owner);
  assert.equal(getLegalCardCost(one, owner, card, 0), card.cost - 1);
  assert.match(getCardCostExplanation(one, owner, card, 0), /BUDDY district discount/);
  assert.equal(getLegalCardCost(one, owner, card, 1), card.cost);
  assert.ok(one.boards.flat().filter(card => card.buddyBud).every(card => card.kind === 'token' && card.hazard));
});
for (const owner of ['player', 'cpu'] as const) test('normal Buddy growth and sprouting resolve together at the two-round boundary for ' + owner, () => {
  const { m, source } = setup('buddy', owner);
  let state = playTurnCard(m, owner, source.instanceId, 0);
  const buds = state.boards.flat().filter(card => card.buddyBud);
  assert.ok(buds.length >= 2);
  const laneIndex = buds[0].lane!;
  const earlierArrival = createCardInstance('cornball', owner, 'bud-test', 1);
  state = playTurnCard({ ...state, [owner === 'player' ? 'playerHand' : 'cpuHand']: [earlierArrival],
    [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9 }, owner, earlierArrival.instanceId, laneIndex);
  const arrival = createCardInstance('hooper', owner, 'bud-test', 1);
  state = playTurnCard({ ...state, [owner === 'player' ? 'playerHand' : 'cpuHand']: [arrival],
    [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9 }, owner, arrival.instanceId, laneIndex);
  state = nextRound({ ...state, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(find(state, source).powerModifier, 0, 'does not grow after only one completed turn');
  state = nextRound({ ...state, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(state.round, 6);
  assert.equal(find(state, source).powerModifier, 3, 'delayed +3 resolves at the beginning of round 6, before final-round scoring');
  assert.equal(find(state, arrival).powerModifier, 3);
  assert.equal(find(state, earlierArrival).powerModifier, 0, 'the previous arrival is not the Bud recipient');
  assert.equal(state.boards[laneIndex].some(card => card.buddyBud), false, 'sprouting consumes a Bud after rewarding its last eligible arrival');
  const complete = nextRound({ ...state, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(complete.phase, 'complete');
  assert.equal(find(complete, source).powerModifier, 3, 'round-6 growth does not repeat at match completion');
});
test('a moved older arrival cannot replace the last-summoned Buddy Bud recipient', () => {
  const { m, source } = setup('buddy');
  let state = playTurnCard(m, 'player', source.instanceId, 0);
  const budLane = state.boards.flat().find(card => card.buddyBud && card.lane !== 0)!.lane!;
  const older = createCardInstance('cornball', 'player', 'bud-order', 1);
  state = playTurnCard({ ...state, playerHand: [older], playerMotion: 9 }, 'player', older.instanceId, 0);
  const newer = createCardInstance('hooper', 'player', 'bud-order', 2);
  state = playTurnCard({ ...state, playerHand: [newer], playerMotion: 9 }, 'player', newer.instanceId, budLane);
  const latest = createCardInstance('vibe', 'player', 'bud-order', 3);
  state = playTurnCard({ ...state, playerHand: [latest], playerMotion: 9 }, 'player', latest.instanceId, budLane);

  const movedOlder = find(state, older);
  assert.equal(movedOlder.lane, budLane, 'Vibe moves the older card into the Bud district');
  assert.ok(movedOlder.arrivalOrder! < find(state, newer).arrivalOrder!);
  assert.equal(state.boards[budLane].at(-1)?.instanceId, older.instanceId, 'the moved older card is appended after newer arrivals');
  assert.ok(find(state, latest).arrivalOrder! > movedOlder.arrivalOrder!);

  state = nextRound({ ...state, phase: 'resolved', playerHand: [], cpuHand: [] });
  state = nextRound({ ...state, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(state.round, 6);
  assert.equal(find(state, latest).powerModifier, 4, 'the truly last summoned character receives the Bud payoff');
  assert.equal(find(state, movedOlder).powerModifier, 1, 'movement order does not override summon order');
});
test('normal Buddy skips Bud planting when every friendly district is full', () => {
  const { m, source } = setup('buddy');
  m.boards = [0, 1, 2].map(laneIndex => Array.from({ length: 4 }, (_, index) =>
    unit('hooper', 'player', laneIndex as Lane, laneIndex * 4 + index))) as Match['boards'];
  const after = playCard(m, 'player', source.instanceId, 0);
  assert.equal(after.boards.flat().filter(card => card.buddyBud).length, 0);
  assert.equal(find(after, source).buddyGrowthAtRound, 6, 'full districts do not cancel delayed self-growth');
});
for (const owner of ['player', 'cpu'] as const) test('Squabbled Buddy transforms, buffs Earth and weakens enemies for exactly two rounds: ' + owner, () => {
  const { m, source, enemy } = setup('buddy', owner);
  const earth = unit('landlord', owner, 1, 10, 5), friendlyNonEarth = unit('hooper', owner, 2, 11, 5);
  const foe = unit('hooper', enemy, 0, 12, 7);
  m.boards = [[foe], [earth], [friendlyNonEarth]];
  const after = playCard(m, owner, source.instanceId, 0, true);
  assert.equal(find(after, source).buddyForm, 'squabble-earth');
  assert.equal(getEffectiveCardPower(find(after, source)), 10, 'ordinary SQUABBLE boost plus the Earth +2 also applies to Buddy');
  assert.equal(find(after, earth).powerModifier, 2);
  assert.equal(find(after, friendlyNonEarth).powerModifier, 0);
  assert.equal(find(after, foe).powerModifier, -1);
  assert.equal(after.timedEffects.filter(effect => effect.kind.startsWith('buddy-earth')).length, 3);
  const once = nextRound({ ...after, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(once.round, 5);
  assert.equal(find(once, earth).powerModifier, 2);
  const replayedOnce = nextRound({ ...JSON.parse(JSON.stringify(after)), phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.deepEqual(replayedOnce.timedEffects, once.timedEffects, 'serialized battle state preserves the same expiry schedule');
  const expired = nextRound({ ...once, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(expired.round, 6, 'the two-round modifiers expire at the start of round 6');
  assert.equal(find(expired, earth).powerModifier, 0);
  assert.equal(find(expired, foe).powerModifier, 0);
  assert.equal(find(expired, source).powerModifier, 4, 'the ordinary Squabble base-Hands boost is permanent');
  assert.equal(expired.timedEffects.some(effect => effect.kind.startsWith('buddy-earth')), false);
  const squabbleEvent = after.effectLog.find(event => event.note.startsWith('Earth Squabble:'));
  assert.deepEqual(squabbleEvent?.duration, { unit: 'round', startsAtRound: 4, expiresAtRound: 6, expiration: 'round-start' });
});
test('a sprouted Bud without a later recipient remains harmless, and late Buddy plants no unusable Buds', () => {
  const { m, source } = setup('buddy');
  let state = playCard(m, 'player', source.instanceId, 0);
  state = nextRound({ ...state, phase: 'resolved', playerHand: [], cpuHand: [] });
  state = nextRound({ ...state, phase: 'resolved', playerHand: [], cpuHand: [] });
  const sprouted = state.boards.flat().filter(card => card.buddyBud?.sprouted && card.lane !== 0);
  assert.ok(sprouted.length >= 2);
  const finished = nextRound({ ...state, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.ok(finished.boards.flat().some(card => card.buddyBud?.sprouted), 'no recipient leaves the sprouted Bud on board');
  assert.equal(find(finished, source).powerModifier, 3);

  const late = setup('buddy');
  late.m.round = 5;
  const latePlay = playCard(late.m, 'player', late.source.instanceId, 0);
  assert.equal(latePlay.boards.flat().filter(card => card.buddyBud).length, 0);
  assert.equal(find(latePlay, late.source).buddyGrowthAtRound, 7, 'the delayed growth is scheduled beyond the six-round match');
  const final = nextRound({ ...latePlay, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(final.round, 6);
  assert.equal(find(final, late.source).powerModifier, 0, 'late-game growth does not occur before its two-round delay');
});
test('active Earth Squabble affects later arrivals and honors protection and uncounterable defense', () => {
  const { m, source, enemy } = setup('buddy');
  const shielded = unit('hooper', enemy, 1, 1, 8), immune = unit('hooper', enemy, 2, 2, 8);
  protect(m, shielded); immune.statuses.uncounterable = true;
  m.boards = [[], [shielded], [immune]];
  const transformed = playCard(m, 'player', source.instanceId, 0, true);
  assert.equal(find(transformed, shielded).powerModifier, 0);
  assert.equal(find(transformed, immune).powerModifier, 0);
  const newEnemy = createCardInstance('hooper', 'cpu', 'new-enemy', 1);
  const afterEnemy = playCard({ ...transformed, phase: 'cpu-reveal', cpuHand: [newEnemy], cpuMotion: 9 }, 'cpu', newEnemy.instanceId, 1);
  assert.equal(find(afterEnemy, newEnemy).powerModifier, -1);
  const newEarth = createCardInstance('landlord', 'player', 'new-earth', 1);
  const afterEarth = playCard({ ...afterEnemy, phase: 'player', playerHand: [newEarth], playerMotion: 9 }, 'player', newEarth.instanceId, 2);
  assert.equal(find(afterEarth, newEarth).powerModifier, 2);
});
for (const owner of ['player', 'cpu'] as const) test('Folks burns every enemy district and buffs only other Fire characters for ' + owner, () => {
  const { m, source, enemy } = setup('folks', owner);
  const normal = unit('hooper', enemy, 0, 1), plant = unit('rastamon', enemy, 1, 2), fire = unit('guap', enemy, 2, 3);
  const ally = unit('guap', owner, 1, 4), otherAlly = unit('cornball', owner, 2, 5);
  const support = { ...unit('buspass', owner, 0, 6), type: 'Fire', kind: 'support' as const };
  const hazard = { ...unit('cornball', enemy, 0, 7), hazard: true as const };
  m.boards = [[normal, support, hazard], [plant, ally], [fire, otherAlly]];
  const after = playCard(m, owner, source.instanceId, 0);
  assert.equal(find(after, normal).statuses.burnStacks, 3); assert.equal(find(after, plant).statuses.burnStacks, 4);
  assert.equal(find(after, fire).statuses.burnStacks, 3); assert.equal(find(after, hazard).statuses.burnStacks, 0);
  assert.equal(find(after, ally).powerModifier, 1);
  for (const untouched of [source, otherAlly, support]) assert.equal(find(after, untouched).powerModifier, 0, untouched.cardId + ': ' + find(after, untouched).lastEffectNote);
  const end = nextRound({ ...after, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(find(end, normal).powerModifier, -3); assert.equal(find(end, plant).powerModifier, -4);
  assert.equal(find(end, normal).statuses.burnStacks, 0);
  const again = nextRound({ ...end, phase: 'resolved', playerHand: [], cpuHand: [] });
  assert.equal(find(again, normal).powerModifier, -3, 'Burn expires after one tick');
});
test('Folks respects shields, ignores uncounterable enemies, and resolves final-round Burn before scoring', () => {
  const { m, source, enemy } = setup('folks');
  const shield = unit('hooper', enemy, 0, 1), immune = unit('hooper', enemy, 1, 2), exposed = unit('hooper', enemy, 2, 3);
  protect(m, shield); immune.statuses.uncounterable = true; m.boards = [[shield], [immune], [exposed]];
  const after = playCard({ ...m, round: 6 }, 'player', source.instanceId, 0);
  assert.equal(find(after, shield).statuses.burnStacks, 0); assert.equal(find(after, immune).statuses.burnStacks, 0);
  const end = nextRound({ ...after, phase: 'resolved' });
  assert.equal(end.phase, 'complete'); assert.equal(find(end, exposed).powerModifier, -3);
});
for (const id of ['buddy', 'folks'] as const) test(id + ' cannot trigger while disabled or manufacture upgrades on an empty board', () => {
  for (const status of ['silenced', 'frozen', 'weakened'] as const) {
    const { m, source, enemy } = setup(id); source.statuses[status] = true;
    const target = unit('guap', enemy, 0, 1); m.boards[0] = [target];
    const after = playCard(m, 'player', source.instanceId, 0);
    assert.equal(find(after, target).powerModifier, 0); assert.equal(find(after, target).statuses.burnStacks, 0);
  }
  const { m, source } = setup(id);
  m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot([id], [], { player: { [id]: { xp: 2800, level: 8, moveTier: 3 } } });
  assert.equal(find(playCard(m, 'player', source.instanceId, 0), source).powerModifier, id === 'buddy' ? 3 : 0);
});
test('SQUABBLE doubles printed Hands without doubling either ability', () => {
  for (const id of ['buddy', 'folks'] as const) {
    const { m, source, enemy } = setup(id), target = unit('guap', enemy, 0, 1);
    m.boards[0] = [target]; const after = playCard(m, 'player', source.instanceId, 0, true);
    assert.equal(getEffectiveCardPower(find(after, source)), id === 'buddy' ? 10 : 6);
    assert.equal(find(after, target).powerModifier, id === 'buddy' ? -1 : 0);
    assert.equal(find(after, source).buddyForm, id === 'buddy' ? 'squabble-earth' : undefined);
    assert.equal(find(after, target).statuses.burnStacks, id === 'folks' ? 3 : 0);
  }
});
test('trained tiers add small targeted bonuses without multiplying board-wide Burn', () => {
  for (const id of ['buddy', 'folks'] as const) {
    const { m, source, enemy } = setup(id), target = unit('guap', enemy, 0, 1), ally = unit('guap', 'player', 1, 2);
    m.boards = [[target], [ally], []]; m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot([id], [], { player: { [id]: { xp: 2800, level: 8, moveTier: 3 } } });
    const after = playCard(m, 'player', source.instanceId, 0);
    assert.equal(getEffectiveCardPower(find(after, source)), id === 'buddy' ? 7 : 5);
    assert.equal(find(after, target).powerModifier, 0);
    assert.equal(find(after, target).statuses.burnStacks, id === 'folks' ? 3 : 0);
    assert.equal(find(after, ally).powerModifier, id === 'folks' ? 2 : 0);
  }
});
