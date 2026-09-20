import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardById, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, playCard, nextRound, getEffectiveCardPower, type CardInstance, type Match, type Owner, type Lane } from './gameEngine';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';

const unit = (id: string, owner: Owner, lane: Lane, index: number, power = 10): CardInstance =>
  ({ ...createCardInstance(id, owner, 'buddy-folks', index), lane, basePower: power, power });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId)!;
function setup(id: 'buddy' | 'folks', owner: Owner = 'player') {
  const source = createCardInstance(id, owner, 'duo', 0);
  const m: Match = { ...createMatch('block', 'combo'), round: 4, phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 9, cpuMotion: 9, playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [] };
  return { source, m, enemy: owner === 'player' ? 'cpu' as const : 'player' as const };
}
function protect(m: Match, card: CardInstance, kind: 'church-protection' | 'nail-mitigation' = 'church-protection') {
  card.statuses.protected = kind === 'church-protection';
  m.timedEffects.push({ id: 'protection:' + card.instanceId, kind, owner: card.owner, lane: card.lane!, sourceInstanceId: 'protector', targetInstanceId: card.instanceId, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' });
}

test('BUDDY and FOLKS have affordable Legendary kits and valid progression', () => {
  for (const id of ['buddy', 'folks'] as const) {
    assert.equal(catalogCardById[id].rarity, 'Legendary');
    assert.deepEqual(catalogCardById[id].acquisitionSources, ['Street Packs']);
  }
  assert.deepEqual([cards.buddy.cost, cards.buddy.power, cards.folks.cost, cards.folks.power], [3, 4, 4, 3]);
  validateCardAbilityUpgrades({ buddy: cards.buddy, folks: cards.folks });
});
for (const owner of ['player', 'cpu'] as const) test('Buddy prioritizes the strongest local Mythical for ' + owner, () => {
  const { m, source, enemy } = setup('buddy', owner);
  const mythic = unit('guap', enemy, 0, 1, 8), weaker = unit('yasuke', enemy, 0, 2, 6);
  const ordinary = unit('hooper', enemy, 0, 3, 12), distant = unit('guap', enemy, 1, 4, 20);
  m.boards = [[ordinary, weaker, mythic], [distant], []];
  const original = JSON.stringify(m), after = playCard(m, owner, source.instanceId, 0);
  assert.equal(find(after, mythic).powerModifier, -5);
  assert.equal(find(after, mythic).statuses.silenced, true);
  assert.equal(getEffectiveCardPower(find(after, source)), 6);
  for (const untouched of [weaker, ordinary, distant]) assert.equal(find(after, untouched).powerModifier, 0);
  assert.equal(JSON.stringify(m), original, 'shared server/client engine does not mutate its input');
});
test('Buddy stays useful without Mythicals, but earns no conditional bonus', () => {
  const { m, source, enemy } = setup('buddy');
  const strong = unit('hooper', enemy, 0, 1, 8), weak = unit('cornball', enemy, 0, 2, 5);
  m.boards[0] = [weak, strong];
  const after = playCard(m, 'player', source.instanceId, 0);
  assert.equal(find(after, strong).powerModifier, -2); assert.equal(find(after, strong).statuses.silenced, false);
  assert.equal(find(after, weak).powerModifier, 0); assert.equal(find(after, source).powerModifier, 0);
});
test('Buddy earns his bonus on a Mythical knockout and never mistakes a summon for its summoner', () => {
  const { m, source, enemy } = setup('buddy');
  const mythic = unit('yasuke', enemy, 0, 1, 4);
  m.boards[0] = [mythic];
  const after = playCard(m, 'player', source.instanceId, 0);
  assert.equal(find(after, mythic), undefined); assert.equal(find(after, source).powerModifier, 2);
  const token = { ...unit('cornball', enemy, 0, 2, 8), cardId: 'steward', id: 'captain-jigga', kind: 'token' as const };
  const tokens = playCard({ ...m, boards: [[token], [], []] }, 'player', source.instanceId, 0);
  assert.equal(find(tokens, token).powerModifier, -2); assert.equal(find(tokens, source).powerModifier, 0);
});
for (const defense of ['shield', 'wifey', 'uncounterable', 'mitigation'] as const) test('Buddy respects ' + defense + ' as one hostile hit', () => {
  const { m, source, enemy } = setup('buddy');
  const target = unit('guap', enemy, 0, 1);
  m.boards[0] = [target];
  if (defense === 'shield') protect(m, target);
  if (defense === 'mitigation') protect(m, target, 'nail-mitigation');
  if (defense === 'uncounterable') target.statuses.uncounterable = true;
  if (defense === 'wifey') { const guard = unit('wifey', enemy, 0, 2); guard.statuses.protected = true; m.boards[0].push(guard); }
  const after = playCard(m, 'player', source.instanceId, 0);
  const landed = defense === 'mitigation';
  assert.equal(find(after, target).powerModifier, landed ? -4 : 0);
  assert.equal(find(after, target).statuses.silenced, landed);
  assert.equal(find(after, source).powerModifier, landed ? 2 : 0);
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
  assert.equal(find(playCard(m, 'player', source.instanceId, 0), source).powerModifier, 0);
});
test('SQUABBLE doubles printed Hands without doubling either ability', () => {
  for (const id of ['buddy', 'folks'] as const) {
    const { m, source, enemy } = setup(id), target = unit('guap', enemy, 0, 1);
    m.boards[0] = [target]; const after = playCard(m, 'player', source.instanceId, 0, true);
    assert.equal(getEffectiveCardPower(find(after, source)), id === 'buddy' ? 10 : 6);
    assert.equal(find(after, target).powerModifier, id === 'buddy' ? -5 : 0);
    assert.equal(find(after, target).statuses.burnStacks, id === 'folks' ? 3 : 0);
  }
});
test('trained tiers add small targeted bonuses without multiplying board-wide Burn', () => {
  for (const id of ['buddy', 'folks'] as const) {
    const { m, source, enemy } = setup(id), target = unit('guap', enemy, 0, 1), ally = unit('guap', 'player', 1, 2);
    m.boards = [[target], [ally], []]; m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot([id], [], { player: { [id]: { xp: 2800, level: 8, moveTier: 3 } } });
    const after = playCard(m, 'player', source.instanceId, 0);
    assert.equal(getEffectiveCardPower(find(after, source)), id === 'buddy' ? 8 : 5);
    assert.equal(find(after, target).powerModifier, id === 'buddy' ? -6 : 0);
    assert.equal(find(after, target).statuses.burnStacks, id === 'folks' ? 3 : 0);
    assert.equal(find(after, ally).powerModifier, id === 'folks' ? 2 : 0);
  }
});
