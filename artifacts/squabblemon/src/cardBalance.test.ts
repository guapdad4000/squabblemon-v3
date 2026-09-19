import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, cards } from './data';
import { createCardInstance, createMatch, getEffectiveCardPower, playTurnCard, type Lane, type Match, type Owner } from './gameEngine';

const mythicals = cardCatalog.filter(card => card.rarity === 'Mythical');
const characters = cardCatalog.filter(card => card.kind !== 'support');
const unit = (id: string, owner: Owner, index: number, lane: Lane) => ({
  ...createCardInstance(id, owner, 'balance', index), lane,
});
const totalHands = (match: Match, owner: Owner) => match.boards.flat()
  .filter(card => card.owner === owner)
  .reduce((total, card) => total + getEffectiveCardPower(card), 0);

test('Mythicals span early and late Motion without inflated printed Hands', () => {
  assert.equal(mythicals.length, 13);
  const costs = mythicals.map(card => card.cost);
  assert(costs.filter(cost => cost <= 3).length >= 3, 'early-round Mythicals need more than one cost option');
  assert(costs.filter(cost => cost === 6).length >= 2, 'late finishers should still require six Motion');
  for (const card of mythicals) {
    assert(card.cost >= 2 && card.cost <= 6, `${card.name} Motion is outside the intended range`);
    const printedBudget = card.engineId === 'yasuke' ? 4 : card.cost + 1;
    assert(card.power <= printedBudget, `${card.name} has too much unconditional Hands for its Motion`);
  }
});

test('every character fits the six-round Motion curve without an oversized free body', () => {
  assert.equal(characters.length, 93);
  assert(characters.filter(card => card.cost === 1).length >= 10, 'crews need enough opening cards');
  assert(characters.filter(card => card.cost >= 4).length >= 15, 'crews need mid- and late-round choices');
  for (const cost of [1, 2, 3, 4]) {
    const printedHands = new Set(characters.filter(card => card.cost === cost).map(card => card.power));
    assert(printedHands.size >= 2, `${cost}-Motion characters need distinct Hands options`);
  }
  for (const card of characters) {
    assert(card.cost >= 1 && card.cost <= 6, `${card.name} cannot fit the six-round Motion curve`);
    const printedBudget = card.engineId === 'yasuke' ? 4 : card.cost + 1;
    assert(card.power >= 1 && card.power <= printedBudget, `${card.name} has excessive unconditional Hands`);
  }
});

test('Mythical reveal swings stay bounded in a favorable contested board', () => {
  const boards: Match['boards'] = [
    [unit('cornball', 'player', 0, 0), unit('plug', 'player', 1, 0), unit('hooper', 'cpu', 2, 0), unit('nerd', 'cpu', 3, 0), unit('gamer', 'cpu', 4, 0)],
    [unit('rastamon', 'player', 5, 1), unit('cornball', 'cpu', 6, 1), unit('plug', 'cpu', 7, 1)],
    [unit('hooper', 'player', 8, 2), unit('bikelife', 'cpu', 9, 2), unit('wifey', 'cpu', 10, 2), unit('snow', 'cpu', 11, 2)],
  ];
  for (const mythic of mythicals) {
    const source = createCardInstance(mythic.engineId, 'player', 'balance', 12);
    const before: Match = { ...createMatch('block', 'block'), round: 5, playerMotion: 9, playerHand: [source], boards };
    const after = playTurnCard(before, 'player', source.instanceId, 0);
    const swing = totalHands(after, 'player') - totalHands(before, 'player')
      - (totalHands(after, 'cpu') - totalHands(before, 'cpu'));
    const expectedNetMotion = cards[mythic.engineId].cost - (mythic.engineId === 'tron' ? 1 : 0);
    assert.equal(9 - after.playerMotion, expectedNetMotion, mythic.name);
    assert(swing <= Math.max(mythic.cost * 2.25, 6), `${mythic.name} swung ${swing} Hands for ${mythic.cost} Motion`);
    assert(swing >= mythic.power, `${mythic.name} lost its printed value on a favorable board`);
  }
});
