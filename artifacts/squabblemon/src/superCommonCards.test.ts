import { completeEngineCrew } from '@workspace/squabblemon-engine/data';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, cards, CARD_RARITY_DEFINITIONS, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatchFromEngineCards, getLegalCardCost, playTurnCard, pass, revealCpuTurn, nextRound, verifyMatchTranscript, type Match, type Owner, type PlayerMove } from './gameEngine';
import { superCommonIds } from '../../../lib/squabblemon-engine/src/superCommonCards';
import { generateStreetPack, STREET_PACK_RARITY_WEIGHTS } from '../../api-server/src/lib/collectionEconomy';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';

const crew = completeEngineCrew(['shiesty', 'waterboy', 'buspass', 'torta', 'cognac', 'bustdown', 'soulfood', 'concrete']);
const instance = (id: string, owner: Owner = 'player', index = 0) => ({ ...createCardInstance(id, owner, 'essentials', index), lane: 0 as const });
const fresh = () => createMatchFromEngineCards('essentials', crew, 'block', completeEngineCrew(['cornball', 'snow', 'roaster', 'rastamon', 'wifey', 'oink', 'baby']));
function reveal(id: string, setup?: (m: Match) => Match, owner: Owner = 'player') {
  const source = instance(id, owner, 99);
  let m: Match = { ...fresh(), phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 3, cpuMotion: 3, [owner === 'player' ? 'playerHand' : 'cpuHand']: [source], boards: [[], [], []] };
  if (setup) m = setup(m);
  return playTurnCard(m, owner, source.instanceId, 0);
}
const find = (m: Match, id: string) => m.boards.flat().find(c => c.cardId === id)!;

test('eight illustrated Super Commons include four support items and have working pack acquisition', () => {
  assert.equal(superCommonIds.length, 8);
  assert.equal(superCommonIds.filter(id => cards[id].kind === 'support').length, 4);
  validateCardAbilityUpgrades();
  assert(CARD_RARITY_DEFINITIONS.SuperCommon.order < CARD_RARITY_DEFINITIONS.Common.order);
  assert(STREET_PACK_RARITY_WEIGHTS.SuperCommon > STREET_PACK_RARITY_WEIGHTS.Common);
  for (const id of superCommonIds) {
    const card = cardCatalog.find(c => c.engineId === id)!;
    assert.equal(card.rarity, 'SuperCommon');
    assert(card.cost <= 2);
    assert(card.acquisitionSources.includes('Street Packs'));
    const owned = cardCatalog.filter(c => c.engineId !== id).map(c => c.catalogId);
    assert.equal(generateStreetPack({ ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0 }, () => 0).rewards[0].cardId, card.id);
  }
});

test('Shiesty YN deterministically repeats its 50% self-summon with an eight-copy cap', () => {
  const run = (index: number) => {
    const source = instance('shiesty', 'player', 1_000 + index);
    return playTurnCard({ ...fresh(), playerMotion: 3, playerHand: [source], boards: [[], [], []] }, 'player', source.instanceId, 0);
  };
  const results = Array.from({ length: 128 }, (_, index) => run(index));
  const counts = results.map(match => match.boards[0].filter(card => card.cardId === 'shiesty').length);
  assert(results.every(match => match.boards.flat().filter(card => card.cardId === 'shiesty').every(card => card.id === cards.shiesty.id)), 'every cloned Shiesty retains his portrait ID through the full chain');
  assert(counts.some(count => count === 1), 'some first flips should miss');
  assert(counts.some(count => count >= 3), 'a summoned copy should sometimes win its own repeat flip');
  assert(counts.every(count => count <= 9), 'the original plus eight extra copies is the hard cap');
  const chainedIndex = counts.findIndex(count => count >= 3);
  assert.deepEqual(run(chainedIndex), run(chainedIndex), 'the chain must replay identically from the same state');
  assert.match(cards.shiesty.effect, /50% chance.*repeats.*8 extra/);
});

test('Torta and Concrete expose hand-bond metadata', () => {
  for (const [id, element] of [['torta', 'Earth'], ['concrete', 'Rock']] as const) {
    assert.equal(cards[id].elementalBond, element);
    assert.equal(find(reveal(id, m => ({ ...m, boards: [[instance('hooper', 'player')], [], []] })), id).powerModifier, 0);
  }
});

test('Torta grants its Earth bond while held in hand at round end', () => {
  const earthAlly = instance('manman', 'player', 7);
  const holder = instance('torta', 'player', 8);
  const after = nextRound({ ...fresh(), phase: 'resolved', playerHand: [holder], boards: [[earthAlly], [], []] });
  assert.equal(find(after, 'manman').powerModifier, 1);
});
test('Water Boy restores exactly one Motion for either owner, and needs company', () => {
  for (const owner of ['player', 'cpu'] as const) {
    const key = owner === 'player' ? 'playerMotion' : 'cpuMotion';
    assert.equal(reveal('waterboy', undefined, owner)[key], 2);
    const m = reveal('waterboy', m => ({ ...m, boards: [[instance('torta', owner)], [], []] }), owner);
    assert.equal(m[key], 3);
    assert.equal(m[owner === 'player' ? 'cpuMotion' : 'playerMotion'], 3);
  }
});

test('Bus Pass and Water Boy allow four plays on the first turn without a draw or turn advance', () => {
  let m = fresh();
  for (const [id, expectedMotion] of [['shiesty', 1], ['waterboy', 1], ['buspass', 1], ['torta', 0]] as const) {
    const card = m.playerHand.find(c => c.cardId === id)!;
    if (id === 'torta') assert.equal(getLegalCardCost(m, 'player', card, 0), 1);
    m = playTurnCard(m, 'player', card.instanceId, 0);
    assert.equal(m.playerMotion, expectedMotion);
    assert.equal(m.phase, 'player');
    assert.equal(m.round, 1);
    assert.equal(m.playerDrawIndex, 5);
    assert.throws(() => playTurnCard(m, 'player', card.instanceId, 0), /Card is not in this hand/);
  }
  assert.equal(m.discountTokens.length, 0, 'the bus discount is consumed once');
  assert.throws(() => playTurnCard(m, 'player', m.playerHand[0].instanceId, 0), /Not enough Motion/);
});

test('Cognac and Soul Food support a character, skipping items and enemies', () => {
  for (const [id, amount] of [['cognac', 2], ['soulfood', 1]] as const) {
    const target = instance('shiesty');
    target.statuses = { ...target.statuses, frozen: true, silenced: true };
    const m = reveal(id, m => ({ ...m, boards: [[instance('buspass', 'player', 1), target, instance('cornball', 'cpu', 2)], [], []] }));
    assert.equal(find(m, 'shiesty').powerModifier, amount);
    assert.equal(find(m, 'buspass').powerModifier, 0);
    assert.equal(find(m, 'cornball').powerModifier, 0);
    assert.equal(find(m, id).powerModifier, 0);
    assert.equal(find(m, 'shiesty').statuses.frozen, id !== 'soulfood');
    assert.equal(find(m, 'shiesty').statuses.silenced, id !== 'soulfood');
    assert.equal(find(reveal(id), id).powerModifier, 0);
  }
});

test('Bust-Down Watch protects a character from one hostile ability, then is consumed', () => {
  let m = reveal('bustdown', m => ({ ...m, boards: [[instance('torta'), instance('buspass', 'player', 1)], [], []] }));
  assert.equal(find(m, 'torta').statuses.protected, true);
  assert.equal(find(m, 'buspass').statuses.protected, false);
  const first = instance('nerd', 'cpu', 7), second = instance('nerd', 'cpu', 8);
  m = { ...m, phase: 'cpu-reveal', cpuHand: [first, second], cpuMotion: 20 };
  m = playTurnCard(m, 'cpu', first.instanceId, 0);
  assert.equal(find(m, 'torta').statuses.silenced, false);
  assert.equal(find(m, 'torta').statuses.protected, false);
  m = playTurnCard(m, 'cpu', second.instanceId, 0);
  assert.equal(find(m, 'torta').statuses.silenced, true);
});

test('silenced or frozen new cards do not fire abilities', () => {
  for (const id of superCommonIds) for (const status of ['silenced', 'frozen'] as const) {
    const m = reveal(id, m => ({ ...m, playerHand: m.playerHand.map(c => ({ ...c, statuses: { ...c.statuses, [status]: true } })), boards: [[instance('torta'), instance('cornball', 'cpu', 1)], [], []] }));
    assert.equal(find(m, 'torta').powerModifier, 0);
    assert.equal(find(m, id).powerModifier, 0);
    assert.equal(m.discountTokens.length, 0);
    assert.equal(m.playerMotion, 3 - cards[id].cost);
  }
});

test('coached Water Boy upgrades require a successful refund; support upgrades boost their target', () => {
  for (const [id, hasAlly, selfBonus, targetBonus] of [
    ['waterboy', false, 0, 0], ['waterboy', true, 3, 0],
    ['cognac', false, 0, 0], ['cognac', true, 0, 5],
    ['soulfood', true, 0, 4], ['bustdown', true, 0, 3],
  ] as const) {
    const m = reveal(id, m => ({ ...m,
      abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(crew, m.cpuCardIds, { player: { [id]: { xp: 4500, level: 10, moveTier: 3 } } }),
      boards: [hasAlly ? [instance('shiesty')] : [], [], []],
    }));
    assert.equal(find(m, id).powerModifier, selfBonus, id);
    if (hasAlly) assert.equal(find(m, 'shiesty').powerModifier, targetBonus, id);
  }
});

test('new cards can complete a deterministic six-round fade and server replay', () => {
  const initial = fresh();
  let m = initial;
  const moves: PlayerMove[] = [];
  for (let round = 1; round <= 6; round++) {
    while (true) {
      const card = m.playerHand.find(c => getLegalCardCost(m, 'player', c, 0) <= m.playerMotion);
      if (!card) break;
      moves.push({ cardInstanceId: card.instanceId, lane: 0, squabble: false, endTurn: false });
      m = playTurnCard(m, 'player', card.instanceId, 0);
    }
    moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
    m = nextRound(revealCpuTurn(pass(m, 'player')));
  }
  assert.equal(m.playerHand.length, 0);
  assert.deepEqual(verifyMatchTranscript('essentials', 'block', moves, initial.abilityUpgradeSnapshot, crew), m);
});
