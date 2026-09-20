import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, playCard, type Match } from './gameEngine';
import { neighborhoodCommonIds } from '../../../lib/squabblemon-engine/src/commonCards';
import { generateStreetPack } from '../../api-server/src/lib/collectionEconomy';

const instance = (id: string, owner: 'player' | 'cpu', index: number) => ({
  ...createCardInstance(id, owner, 'commons-test', index), lane: 0 as const,
});
function reveal(id: string, setup?: (match: Match) => Match) {
  const source = instance(id, 'player', 0);
  let match: Match = { ...createMatch('vibes', 'vibes'), playerMotion: 20, playerHand: [source], boards: [[], [], []] };
  if (setup) match = setup(match);
  return playCard(match, 'player', source.instanceId, 0);
}

test('all eleven neighborhood cards are Common, upgradeable, and individually obtainable in Street Packs', () => {
  assert.equal(neighborhoodCommonIds.length, 11);
  validateCardAbilityUpgrades();
  for (const id of neighborhoodCommonIds) {
    const card = cardCatalog.find(c => c.engineId === id)!;
    assert.equal(card.rarity, 'Common');
    assert(card.acquisitionSources.includes('Street Packs'));
    const owned = cardCatalog.filter(c => c.engineId !== id).map(c => c.catalogId);
    const pack = generateStreetPack({ ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0 }, () => 0);
    assert.equal(pack.rewards[0].cardId, card.catalogId);
    assert.equal(pack.rewards[0].isNew, true);
  }
});

test('Common self boosts honor their printed conditions', () => {
  const cases = [
    ['youngbull', [], [instance('cornball', 'cpu', 1)], 1],
    ['transplant', [], [], 1],
    ['edgar', [instance('cornball', 'player', 1)], [], 1],
    ['manman', [instance('cornball', 'player', 1), instance('plug', 'player', 2)], [], 2],
  ] as const;
  for (const [id, allies, enemies, amount] of cases) {
    const m = reveal(id, m => ({ ...m, boards: [[...allies, ...enemies], [], []] }));
    assert.equal(m.boards[0].find(c => c.cardId === id)?.powerModifier, amount, id);
  }
  for (const id of ['youngbull', 'edgar', 'manman']) assert.equal(reveal(id).boards[0][0].powerModifier, 0);
  assert.equal(reveal('transplant', m => ({ ...m, boards: [[instance('cornball', 'player', 1)], [], []] })).boards[0].find(c => c.cardId === 'transplant')?.powerModifier, 0);
  assert.equal(reveal('nguyen').boards[0][0].powerModifier, 0);
  assert.equal(reveal('nguyen', m => ({ ...m, playerMotion: 2, boards: [[], [{ ...instance('cornball', 'player', 1), lane: 1 }], []] })).boards[0][0].powerModifier, 1);
});

test('supports buff allies without buffing enemies or themselves; nurse cleanses statuses', () => {
  for (const [id, amount, both] of [['earthy', 1, false], ['abuela', 2, false], ['icecream', 1, true]] as const) {
    const m = reveal(id, m => ({ ...m, boards: [[instance('cornball', 'player', 1), instance('plug', 'player', 2), instance('cornball', 'cpu', 3)], [], []] }));
    assert.equal(m.boards[0][0].powerModifier, amount);
    assert.equal(m.boards[0][1].powerModifier, both ? amount : 0);
    assert.equal(m.boards[0][2].powerModifier, 0);
    assert.equal(m.boards[0].find(c => c.cardId === id)?.powerModifier, 0);
  }
  const ally = instance('cornball', 'player', 1);
  ally.statuses = { ...ally.statuses, frozen: true, silenced: true };
  const m = reveal('pinaynurse', m => ({ ...m, boards: [[ally], [], []] }));
  assert.equal(m.boards[0][0].statuses.frozen, false);
  assert.equal(m.boards[0][0].statuses.silenced, false);
  assert.equal(m.boards[0][0].powerModifier, 2);
});

test('Pinay Nurse cleanses and gives the lowest-Hands ally +2 Hands', () => {
  const ally = instance('cornball', 'player', 1);
  ally.statuses = { ...ally.statuses, frozen: true, silenced: true };
  const m = reveal('pinaynurse', match => ({ ...match, boards: [[ally], [], []] }));
  const treated = m.boards[0].find(card => card.instanceId === ally.instanceId)!;
  assert.equal(treated.statuses.frozen, false);
  assert.equal(treated.statuses.silenced, false);
  assert.equal(treated.powerModifier, 2);
});

test('Tayaty and Honest Thot target only the lowest enemy', () => {
  for (const id of ['tayaty', 'honestthot']) {
    const m = reveal(id, m => ({ ...m, boards: [[{ ...instance('cornball', 'cpu', 1), basePower: 2 }, instance('hooper', 'cpu', 2)], [], []] }));
    assert.equal(m.boards[0][0].powerModifier, id === 'tayaty' ? -1 : 0);
    assert.equal(m.boards[0][0].statuses.silenced, id === 'honestthot');
    assert.equal(m.boards[0][1].powerModifier, 0);
    assert.equal(m.boards[0][1].statuses.silenced, false);
  }
});

test('new hostile abilities respect Wifey and silenced Commons cannot fire', () => {
  for (const id of ['tayaty', 'honestthot']) {
    const guard = instance('wifey', 'cpu', 1);
    guard.statuses.protected = true;
    const m = reveal(id, m => ({ ...m, boards: [[instance('cornball', 'cpu', 2), guard], [], []] }));
    assert.equal(m.boards[0][0].powerModifier, 0);
    assert.equal(m.boards[0][0].statuses.silenced, false);
  }
  const m = reveal('icecream', m => ({ ...m,
    playerHand: m.playerHand.map(c => ({ ...c, statuses: { ...c.statuses, silenced: true } })),
    boards: [[instance('cornball', 'player', 1)], [], []],
  }));
  assert.equal(m.boards[0][0].powerModifier, 0);
});
