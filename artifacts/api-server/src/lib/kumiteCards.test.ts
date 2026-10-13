import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardById, KUMITE_CARD_REWARDS, KUMITE_EXCLUSIVE_CARD_IDS, validateCardAbilityUpgrades, validateSavedDeck, ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';
import { createCardInstance, createMatch, playCard, type Lane, type Match, type Owner } from '@workspace/squabblemon-engine/gameEngine';
import { draftOffers } from '@workspace/squabblemon-engine/activities';
import { generateStreetPack } from './collectionEconomy';

const unit = (owner: Owner, index: number, lane: Lane, power = 5) => ({ ...createCardInstance('hooper', owner, 'kumite-unit', index), lane, basePower: power });
function cast(id: string, owner: Owner, boards: Match['boards']) {
  const card = createCardInstance(id, owner, 'kumite-cast', 100);
  const match = { ...createMatch('block', 'slide'), boards,
    timedEffects: boards.flat().filter(card => card.statuses.protected).map(card => ({ id: `shield:${card.instanceId}`,
      kind: 'church-protection' as const, sourceInstanceId: card.instanceId, targetInstanceId: card.instanceId,
      owner: card.owner, lane: card.lane!, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' as const })),
    phase: owner === 'player' ? 'player' as const : 'cpu-reveal' as const,
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [card], [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9 };
  const before = structuredClone(match);
  const result = playCard(match, owner, card.instanceId, 0);
  assert.deepEqual(match, before, 'ability keeps the input snapshot immutable');
  assert.deepEqual(result, playCard(match, owner, card.instanceId, 0), 'same snapshot deterministically replays');
  return result;
}
const get = (match: Match, id: string) => match.boards.flat().find(card => card.cardId === id)!;

test('eight roadmap milestones preserve canonical existing fighters and authored rarities', () => {
  assert.equal(KUMITE_CARD_REWARDS.length, 8);
  assert.equal(new Set(KUMITE_CARD_REWARDS.map(reward => reward.id)).size, 8);
  const expected = [['dragonfly-jones', 'dragonflyjones', 'Legendary'], ['undercova-brotha', 'undercova', 'Rare'],
    ['sho-nuff', 'shonuff', 'Legendary'], ['leroy', 'leroy', 'Mythical'], ['yasuke', 'yasuke', 'Mythical']];
  for (const [id, engineId, rarity] of expected) {
    assert.equal(catalogCardById[id].engineId, engineId); assert.equal(catalogCardById[id].rarity, rarity);
    assert(KUMITE_CARD_REWARDS.some(reward => reward.cardId === id));
    assert(!(KUMITE_EXCLUSIVE_CARD_IDS as readonly string[]).includes(id), 'existing fighters keep ordinary acquisition sources');
  }
});

test('three playable Kumite cards have valid growth paths and progression-only acquisition', () => {
  validateCardAbilityUpgrades(Object.fromEntries(KUMITE_EXCLUSIVE_CARD_IDS.map(id => [id, cards[id]])));
  for (const id of KUMITE_EXCLUSIVE_CARD_IDS) {
    assert.deepEqual(catalogCardById[id].acquisitionSources, ['Kumite progression']);
    assert.equal(cards[id].kind, 'character');
    const gang = [...ROOKIE_CORE_IDS.slice(0, 9), id];
    assert.equal(validateSavedDeck(gang, gang, id).valid, true, 'earned fighter works in ordinary saved gangs');
    assert.equal(validateSavedDeck(gang, [...ROOKIE_CORE_IDS], id).valid, false, 'unearned fighter cannot enter a submitted gang');
  }
  let seed = 123456;
  const rng = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let i = 0; i < 200; i++) {
    const pack = generateStreetPack({ ownedCardIds: [], discoveredCardIds: [], ownedVariants: [], pity: 0 }, rng);
    assert(pack.rewards.every(reward => !reward.cardId || !(KUMITE_EXCLUSIVE_CARD_IDS as readonly string[]).includes(reward.cardId)));
  }
  for (const offer of draftOffers('2026-10-12')) assert(offer.every(id => !(KUMITE_EXCLUSIVE_CARD_IDS as readonly string[]).includes(id)));
});
for (const owner of ['player', 'cpu'] as const) {
  const enemy = owner === 'player' ? 'cpu' : 'player';
  test(`Kumite fighters resolve distinct bounded effects for ${owner}`, () => {
    const ally = unit(owner, 1, 0, 2), strong = unit(enemy, 2, 0, 7);
    const brown = cast('bushedo-brown', owner, [[ally, strong], [], []]);
    assert.equal(brown.boards[0].find(card => card.instanceId === ally.instanceId)!.statuses.protected, true);
    assert.equal(brown.boards[0].find(card => card.instanceId === strong.instanceId)!.powerModifier, -1);
    const duke = cast('franklin-duke', owner, [[strong], [], []]);
    assert.equal(get(duke, 'franklin-duke').powerModifier, 2);
    assert.equal(duke.boards[0].find(card => card.instanceId === strong.instanceId)!.powerModifier, -2);
    const away = unit(owner, 3, 1, 2);
    const coach = cast('franklin-duke', owner, [[], [away], []]);
    assert.equal(coach.boards[1][0].powerModifier, 1);
    const other1 = unit(enemy, 4, 1, 6), other2 = unit(enemy, 5, 2, 6);
    const chonk = cast('chonk-lee', owner, [[], [other1], [other2]]);
    assert.equal(get(chonk, 'chonk-lee').powerModifier, 2);
    assert.equal(chonk.boards[1][0].powerModifier, -1);
    assert.equal(chonk.boards[2][0].powerModifier, -1);
  });
}
test('protected targets block Franklin and Chonk self gains; empty districts grant no free power', () => {
  const target = unit('cpu', 1, 0, 7);
  target.statuses = { ...target.statuses, protected: true };
  assert.equal(get(cast('franklin-duke', 'player', [[target], [], []]), 'franklin-duke').powerModifier, 0);
  const away = { ...target, lane: 1 as const };
  assert.equal(get(cast('chonk-lee', 'player', [[], [away], []]), 'chonk-lee').powerModifier, 0);
  assert.equal(get(cast('chonk-lee', 'player', [[], [], []]), 'chonk-lee').powerModifier, 0);
});
