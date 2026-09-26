import assert from 'node:assert/strict';
import test from 'node:test';
import { ELEMENTAL_WAVE } from '../../../lib/squabblemon-engine/src/elementalWave';
import { CARD_RARITY_DEFINITIONS, cardCatalog, cards, completeEngineCrew, decks, validateCardAbilityUpgrades } from './data';
import { choosePackCardFromTier } from '@workspace/squabblemon-engine/packRules';
import { generateStreetPack } from '../../api-server/src/lib/collectionEconomy';
import { createAbilityUpgradeSnapshot, createCardInstance, createMatch, createMatchFromEngineCards, nextRound, pass, playCard, playTurnCard, revealCpuTurn, verifyMatchTranscript, type Match, type PlayerMove } from './gameEngine';

const unit = (id: string, owner: 'player' | 'cpu', index: number, lane: 0 | 1 | 2 = 0) =>
  ({ ...createCardInstance(id, owner, 'elemental-wave', index), lane });

test('sixteen collectible fighters, normal rarity pools, entry colors, trained tiers and a playable Water crew', () => {
  assert.equal(ELEMENTAL_WAVE.length, 16);
  assert.equal(validateCardAbilityUpgrades(), cards);
  for (const element of ['Water', 'Electric', 'Plant', 'Air']) {
    const family = ELEMENTAL_WAVE.filter(row => row[4] === element);
    assert.equal(family.length, 4);
    assert.equal(new Set(family.map(row => row[3])).size, 4);
    assert(family.some(row => row[10] === element && (row[3] === 'Rare' || row[3] === 'Epic')));
  }
  for (const [id, catalogId, , rarity, element] of ELEMENTAL_WAVE) {
    const card = cardCatalog.find(entry => entry.engineId === id)!;
    assert.equal(card.catalogId, catalogId);
    assert.equal(card.rarity, rarity);
    assert.equal(card.type, element);
    assert.equal(card.abilityUpgrades.length, 3);
    assert(card.entryVfx?.accent && card.portraitAccent);
    assert(CARD_RARITY_DEFINITIONS[rarity].cue.includes('◆'));
    assert(card.acquisitionSources.includes('Street Packs'));
    const tier = cardCatalog.filter(entry => entry.rarity === rarity);
    assert.equal(choosePackCardFromTier({ rarity, tier, pulledCardIds: new Set(), ownedCardIds: new Set(tier.filter(entry => entry.engineId !== id).map(entry => entry.catalogId)), protectNew: true, rng: () => 0 }).engineId, id);
    const threshold = { Common: 4000, Uncommon: 6000, Rare: 8500, Epic: 9700 }[rarity];
    let calls = 0;
    const owned = cardCatalog.filter(entry => entry.engineId !== id).map(entry => entry.catalogId);
    const pack = generateStreetPack({ ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0 },
      () => calls++ === 0 ? threshold : 0);
    assert.equal(pack.rewards[0].cardId, catalogId);
  }
  const water = decks.find(deck => deck.id === 'rain')!;
  assert.equal(water.cards.length, 10);
  assert(water.cards.every(id => cards[id]?.type === 'Water'));
  assert.equal(completeEngineCrew(water.cards).length, 10);
  assert.equal(createMatch('rain', 'rain').playerHand.length, 5);
});

test('every new reveal effect changes the intended ally, lane, or Motion for both owners', () => {
  for (const owner of ['player', 'cpu'] as const) {
    for (const [id] of ELEMENTAL_WAVE) {
      const source = unit(id, owner, 1);
      const ally = unit('raincaller', owner, 2);
      const plant = unit('vinekeeper', owner, 3);
      const electric = unit('switchboard', owner, 4, 1);
      const air = unit('roofrunner', owner, 5);
      const remotePlant = unit('mosskeeper', owner, 6, 1);
      const thirdPlant = unit('seedvendor', owner, 7, 2);
      ally.statuses.frozen = true;
      plant.statuses.burnStacks = 2;
      electric.statuses.silenced = true;
      const base = createMatch('rain', 'rain');
      const before: Match = { ...base, phase: owner === 'player' ? 'player' : 'cpu-reveal',
        playerMotion: 9, cpuMotion: 9,
        playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [],
        boards: [[ally, plant, air], [electric, remotePlant], [thirdPlant]] };
      const after = playCard(before, owner, source.instanceId, 0);
      const find = (key: string) => after.boards.flat().find(card => card.instanceId === key)!;
      const refund = (owner === 'player' ? after.playerMotion : after.cpuMotion) - (9 - source.cost);
      if (id === 'puddle' || id === 'hydrant' || id === 'floodgate') assert.equal(find(ally.instanceId).statuses.frozen, false, id);
      if (id === 'hydrant') assert.equal(find(plant.instanceId).statuses.burnStacks, 0, id);
      if (id === 'floodgate') assert.equal(find(electric.instanceId).statuses.silenced, false, id);
      if (id === 'seedvendor' || id === 'canopy') assert(find(plant.instanceId).powerModifier > 0, id);
      if (id === 'mosskeeper') assert.equal(find(thirdPlant.instanceId).powerModifier, 2, id);
      if (id === 'circuityn' || id === 'powerstation') assert.equal(refund, 1, id);
      if (id === 'flashcourier') assert(after.discountTokens.some(token => token.sourceInstanceId === source.instanceId));
      if (id === 'gustscout' || id === 'blockmessenger' || id === 'skyline') {
        const traveler = id === 'gustscout' ? source : id === 'skyline' ? air : ally;
        assert.notEqual(find(traveler.instanceId).lane, 0, id);
        assert.equal(find(traveler.instanceId).powerModifier, id === 'skyline' ? 2 : 1, id);
      }
      if (['raincaller', 'vinekeeper', 'switchboard', 'roofrunner'].includes(id)) assert.equal(after.boards.flat().find(card => card.instanceId === source.instanceId)?.powerModifier, 0);
      assert(after.effectLog.some(event => event.type === 'ability'), id);
      assert.equal(ally.statuses.frozen, true, 'input is immutable');
    }
  }
});

test('new and original hand bonds stack by element; trained bonds remain deterministic', () => {
  for (const [bondId, oldId, allyId] of [
    ['raincaller', 'icecream', 'hydrant'], ['vinekeeper', 'gardener', 'mosskeeper'],
    ['switchboard', 'piratedj', 'powerstation'], ['roofrunner', 'honestthot', 'gustscout'],
  ] as const) {
    for (let tier = 0; tier <= 3; tier++) {
      const bond = unit(bondId, 'player', 10);
      const original = unit(oldId, 'player', 11);
      const ally = unit(allyId, 'player', 12);
      const wrong = unit('cornball', 'player', 13);
      const cpu = unit(allyId, 'cpu', 14);
      const match: Match = { ...createMatch('rain', 'rain'), round: 6, phase: 'resolved',
        playerHand: [bond, original], cpuHand: [],
        boards: [[ally, wrong, cpu], [], []],
        abilityUpgradeSnapshot: createAbilityUpgradeSnapshot([bondId, oldId], [], {
          player: { [bondId]: { xp: 2800, level: 8, moveTier: tier } },
        }),
      };
      const after = nextRound(match);
      assert.equal(after.boards[0].find(card => card.instanceId === ally.instanceId)?.powerModifier, 2 + tier, bondId);
      assert.equal(after.boards[0].find(card => card.instanceId === wrong.instanceId)?.powerModifier, 0);
      assert.equal(after.boards[0].find(card => card.instanceId === cpu.instanceId)?.powerModifier, 0);
    }
  }
  const water = unit('puddle', 'player', 31);
  const fire = unit('youngbull', 'player', 32);
  const mixed: Match = { ...createMatch('rain', 'rain'), round: 6, phase: 'resolved',
    playerHand: [unit('raincaller', 'player', 33), unit('icecream', 'player', 34), unit('guap', 'player', 35)],
    boards: [[water, fire], [], []] };
  const after = nextRound(mixed);
  assert.equal(after.boards[0].find(card => card.instanceId === water.instanceId)?.powerModifier, 2);
  assert.equal(after.boards[0].find(card => card.instanceId === fire.instanceId)?.powerModifier, 1);
});

test('new reveal upgrades apply only after the authored ability succeeds', () => {
  const crew = completeEngineCrew(['hydrant', 'puddle']);
  const snapshot = createAbilityUpgradeSnapshot(crew, [], { player: { hydrant: { xp: 2800, level: 8 } } });
  const source = unit('hydrant', 'player', 36);
  const ally = unit('puddle', 'player', 37);
  ally.statuses.burnStacks = 2;
  const base = { ...createMatch('rain', 'rain'), playerMotion: 9, playerHand: [source], abilityUpgradeSnapshot: snapshot };
  const success = playCard({ ...base, boards: [[ally], [], []] }, 'player', source.instanceId, 0);
  assert.equal(success.boards[0].find(card => card.instanceId === source.instanceId)?.powerModifier, 3);
  assert.equal(success.boards[0].find(card => card.instanceId === ally.instanceId)?.statuses.burnStacks, 0);
  const failure = playCard({ ...base, boards: [[], [], []] }, 'player', source.instanceId, 0);
  assert.equal(failure.boards[0].find(card => card.instanceId === source.instanceId)?.powerModifier, 0);
});

test('new Plant and Electric defenders receive the unchanged elemental matchup Burn bonus', () => {
  for (const [attacker, defender, expected] of [
    ['youngbull', 'seedvendor', 2], ['youngbull', 'circuityn', 1],
    ['roaster', 'switchboard', 3], ['roaster', 'hydrant', 2],
  ] as const) {
    const enemy = unit(defender, 'cpu', 21);
    const source = unit(attacker, 'player', 22);
    const match: Match = { ...createMatch('rain', 'rain'), playerMotion: 9, playerHand: [source], boards: [[enemy], [], []] };
    const after = playCard(match, 'player', source.instanceId, 0);
    assert.equal(after.boards[0].find(card => card.instanceId === enemy.instanceId)?.statuses.burnStacks, expected);
  }
});

test('wave fighters replay exact real moves through the authoritative engine', () => {
  for (let offset = 0; offset < ELEMENTAL_WAVE.length; offset += 10) {
    const crew = completeEngineCrew(ELEMENTAL_WAVE.slice(offset, offset + 10).map(row => row[0]));
    let match = createMatchFromEngineCards('elemental', crew, 'rain', createMatch('rain', 'rain').cpuCardIds);
    const initial = match;
    const moves: PlayerMove[] = [];
    while (match.phase !== 'complete') {
      const card = match.playerHand.find(item => item.cost <= match.playerMotion);
      if (card) {
        moves.push({ endTurn: false, cardInstanceId: card.instanceId, lane: 0, squabble: false });
        match = playTurnCard(match, 'player', card.instanceId, 0);
      } else {
        moves.push({ endTurn: true, cardInstanceId: null, lane: null, squabble: false });
        match = nextRound(revealCpuTurn(pass(match, 'player')));
      }
    }
    assert.deepEqual(verifyMatchTranscript('elemental', 'rain', moves, initial.abilityUpgradeSnapshot, crew), match);
  }
  assert.equal(decks.find(deck => deck.id === 'rain')!.cards.filter(id => cards[id].elementalBond === 'Water').length, 2);
});