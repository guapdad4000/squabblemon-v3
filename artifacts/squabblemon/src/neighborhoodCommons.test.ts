import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, cards, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, nextRound, playCard, playTurnCard, type Match } from './gameEngine';
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
  assert.equal(cards.youngbull.power, 2);
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
  assert.equal(reveal('youngbull').boards[0][0].powerModifier, 1);
  for (const id of ['edgar', 'manman']) assert.equal(reveal(id).boards[0][0].powerModifier, 0);
  assert.equal(reveal('transplant', m => ({ ...m, boards: [[instance('cornball', 'player', 1)], [], []] })).boards[0].find(c => c.cardId === 'transplant')?.powerModifier, 0);
  assert.equal(reveal('nguyen').boards[0][0].powerModifier, 0);
  assert.equal(reveal('nguyen', m => ({ ...m, playerMotion: 2, boards: [[], [{ ...instance('cornball', 'player', 1), lane: 1 }], []] })).boards[0][0].powerModifier, 1);
});

test('Grounded buffs one ally, pure bonds stay ongoing, and Nurse cleanses statuses', () => {
  let m = reveal('earthy', m => ({ ...m, boards: [[instance('cornball', 'player', 1), instance('plug', 'player', 2), instance('cornball', 'cpu', 3)], [], []] }));
  assert.equal(m.boards[0][0].powerModifier, 1);
  assert.equal(m.boards[0][1].powerModifier, 0);
  assert.equal(m.boards[0][2].powerModifier, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'earthy')?.powerModifier, 0);
  for (const [id, bond] of [['abuela', 'Light'], ['icecream', 'Water']] as const) {
    m = reveal(id, match => ({ ...match, boards: [[instance('cornball', 'player', 1), instance('plug', 'player', 2)], [], []] }));
    assert.equal(cards[id].elementalBond, bond);
    assert(m.boards[0].every(card => card.powerModifier === 0));
  }
  const ally = instance('cornball', 'player', 1);
  ally.statuses = { ...ally.statuses, frozen: true, silenced: true };
  m = reveal('pinaynurse', match => ({ ...match, boards: [[ally], [], []] }));
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

test('Tayaty echoes the previous On Reveal while Honest Thot stays an Air hand bond', () => {
  const youngBull = instance('youngbull', 'player', 10);
  const tayaty = instance('tayaty', 'player', 11);
  const ongoingBond = instance('honestthot', 'player', 13);
  const enemy = { ...instance('hooper', 'cpu', 12), basePower: 6 };
  let m: Match = { ...createMatch('vibes', 'vibes'), playerMotion: 20, playerHand: [youngBull, ongoingBond, tayaty], boards: [[enemy], [], []] };
  m = playTurnCard(m, 'player', youngBull.instanceId, 0);
  assert.equal(m.lastRevealedCardId, 'youngbull');
  m = playTurnCard(m, 'player', ongoingBond.instanceId, 1);
  assert.equal(m.lastRevealedCardId, 'youngbull', 'a pure Ongoing card must not replace the latest On Reveal');
  m = playTurnCard(m, 'player', tayaty.instanceId, 0);
  assert.equal(m.boards[0].find(card => card.instanceId === tayaty.instanceId)?.powerModifier, 2);
  assert.equal(m.boards[0].find(card => card.instanceId === enemy.instanceId)?.statuses.burnStacks, 2);
  assert.equal(m.lastRevealedCardId, 'tayaty');
  assert.equal(nextRound({ ...m, phase: 'resolved' }).lastRevealedCardId, null);

  const bond = reveal('honestthot', match => ({ ...match, boards: [[instance('hooper', 'cpu', 20)], [], []] }));
  assert.equal(cards.honestthot.elementalBond, 'Air');
  assert.equal(bond.boards[0][0].statuses.silenced, false);
});

test('Young Bull Burn respects Wifey and disabled Commons cannot fire', () => {
  const guard = instance('wifey', 'cpu', 1);
  guard.statuses.protected = true;
  const victim = instance('hooper', 'cpu', 2);
  let m = reveal('youngbull', match => ({ ...match, boards: [[guard, victim], [], []] }));
  assert.equal(m.boards[0].find(card => card.instanceId === victim.instanceId)?.statuses.burnStacks, 0);
  assert.equal(m.boards[0].find(card => card.instanceId === guard.instanceId)?.statuses.blocked, true);
  assert.equal(m.boards[0].find(card => card.cardId === 'youngbull')?.powerModifier, 1);
  m = reveal('youngbull', match => ({ ...match,
    playerHand: match.playerHand.map(c => ({ ...c, statuses: { ...c.statuses, silenced: true } })),
    boards: [[instance('hooper', 'cpu', 3)], [], []],
  }));
  assert.equal(m.boards[0].find(card => card.cardId === 'youngbull')?.powerModifier, 0);
  assert.equal(m.boards[0][0].statuses.burnStacks, 0);
});
