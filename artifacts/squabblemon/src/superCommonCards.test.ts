import { completeEngineCrew } from '@workspace/squabblemon-engine/data';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, cards, CARD_RARITY_DEFINITIONS, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatchFromEngineCards, getLegalCardCost, playTurnCard, pass, revealCpuTurn, nextRound, verifyMatchTranscript, getDistrictSharedBonus, DISTRICT_CATALOG, type Match, type Owner, type PlayerMove } from './gameEngine';
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
  for (const [id, element] of [['torta', 'Earth'], ['concrete', 'Earth']] as const) {
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

test('Rock merges into Earth without changing catalog, rarity, stats or upgrade IDs', () => {
  assert(!cardCatalog.some(c => c.type === 'Rock' || c.elementalBond === 'Rock'));
  const earth = cardCatalog.filter(c => c.type === 'Earth' && (c.kind ?? 'character') === 'character');
  assert.equal(earth.length, 19);
  assert(earth.some(c => c.engineId === 'buddy'), 'Earth cardinality includes Buddy’s new Earth identity');
  for (const [id, catalogId, rarity, cost, power] of [
    ['concrete', 'concrete', 'SuperCommon', 1, 1],
    ['landlord', 'landlord', 'Legendary', 2, 3],
    ['johnhenry', 'john-henry', 'Mythical', 5, 6],
  ] as const) {
    const entry = cardCatalog.find(c => c.engineId === id)!;
    assert.equal(entry.catalogId, catalogId);
    assert.equal(entry.type, 'Earth'); assert.equal(entry.rarity, rarity);
    assert.equal(entry.cost, cost); assert.equal(entry.power, power);
    assert.deepEqual(entry.abilityUpgrades.map(u => u.id), [1, 2, 3].map(t => `${id}:upgrade:${t}`));
  }
  assert.equal(cards.concrete.ability, 'Earth Bond');
  assert.match(cards.concrete.effect, /other Earth characters/);
});

for (const owner of ['player', 'cpu'] as const) test('Torta and Concrete stack Earth bonds across districts for ' + owner, () => {
  const enemy = owner === 'player' ? 'cpu' : 'player';
  const m: Match = { ...fresh(), phase: 'resolved', playerHand: [], cpuHand: [],
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [instance('torta', owner, 20), instance('concrete', owner, 21)],
    boards: [[instance('manman', owner, 1), instance('manman', enemy, 2)],
      [{ ...instance('landlord', owner, 3), lane: 1 }],
      [{ ...instance('johnhenry', owner, 4), lane: 2 }, { ...instance('hooper', owner, 5), lane: 2 }]],
  };
  const before = JSON.stringify(m), after = nextRound(m);
  for (const id of ['manman', 'landlord', 'johnhenry']) assert.equal(find(after, id).powerModifier, 2);
  assert.equal(after.boards[0].find(c => c.owner === enemy)!.powerModifier, 0);
  assert.equal(find(after, 'hooper').powerModifier, 0);
  assert.equal(JSON.stringify(m), before, 'round resolution does not mutate the saved input');
});

test('a legacy Rock bond and old Rock ally share the Earth pool after JSON restore', () => {
  const holder = { ...instance('concrete'), type: 'Rock', elementalBond: 'Rock' };
  const legacy = { ...instance('landlord', 'player', 2), type: 'Rock' };
  const m: Match = { ...fresh(), phase: 'resolved', playerHand: [holder], cpuHand: [],
    boards: [[instance('manman', 'player', 1), legacy], [], []],
    abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(crew, fresh().cpuCardIds,
      { player: { concrete: { xp: 4500, level: 10, moveTier: 3 } } }),
  };
  const after = nextRound(JSON.parse(JSON.stringify(m)));
  assert.equal(find(after, 'manman').powerModifier + find(after, 'landlord').powerModifier, 5,
    'both receive the bond and all three earned training boosts still apply');
  assert.match(find(after, 'landlord').lastEffectNote ?? '', /Earth bond/);
});

test('Earth and legacy Rock cannot count as two elements for district diversity', () => {
  const m: Match = { ...fresh(), boards: [[instance('manman'), { ...instance('landlord', 'player', 1), type: 'Rock' }, instance('hooper', 'player', 2)], [], []],
    districtSnapshot: { version: 1, locations: [DISTRICT_CATALOG.find(d => d.id === 'time-square')!, DISTRICT_CATALOG[0], DISTRICT_CATALOG[1]] },
  };
  assert.equal(getDistrictSharedBonus(m, 'player', 0), 0);
  m.boards[0].push(instance('waterboy', 'player', 3));
  assert.equal(getDistrictSharedBonus(m, 'player', 0), 3);
});

test('John Henry keeps Steel Driver strength as Earth and in legacy snapshots', () => {
  for (const type of ['Earth', 'Rock']) {
    const source = { ...instance('johnhenry', 'player', 3), type };
    const target = instance('techbro', 'cpu', 4);
    const after = playTurnCard({ ...fresh(), playerMotion: 9, playerHand: [source], cpuHand: [],
      boards: [[instance('manman'), instance('landlord', 'player', 1), target], [], []] },
    'player', source.instanceId, 0);
    assert.equal(find(after, 'johnhenry').powerModifier, 2);
    assert.equal(find(after, 'techbro').powerModifier, -2);
    assert.match(find(after, 'techbro').lastEffectNote ?? '', /Steel Driver/);
  }
});
