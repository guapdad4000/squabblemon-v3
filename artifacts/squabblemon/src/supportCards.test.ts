import assert from 'node:assert/strict';
import test from 'node:test';
import { SavePlayerDeckBody, StartPlayerMatchBody } from '@workspace/api-zod';
import { cardCatalog, cards, completeEngineCrew, DECK_SIZE, MAX_MOTION, upgradeLegacySavedDeck, validateSavedDeck } from './data';
import { createAbilityUpgradeSnapshot, DISTRICT_CATALOG, createCardInstance, createMatch, createMatchFromEngineCards, createStoryMatch, nextRound, pass, playTurnCard, revealCpuTurn, verifyMatchTranscript, type DistrictSnapshot, type Match, type Owner, type PlayerMove } from './gameEngine';
import { supportCardIds } from '../../../lib/squabblemon-engine/src/supportCards';
import { draftOffers, validateDraft, makeActivityEncounter } from '@workspace/squabblemon-engine/activities';
import { moveAssignments, resolveSpecialMove } from './specialMoves';

const crew = completeEngineCrew(['energydrink', 'charger', 'cornball', 'plug', 'boombox', 'firstaid', 'subwaymap', 'workboots']);
const unit = (id: string, owner: Owner, index = 0) => ({ ...createCardInstance(id, owner, 'supports', index), lane: 0 as const });
test('requested balance pass updates starting Hands, Motion, support strength, and Buttahs display name', () => {
  assert.equal(cards.landlord.power, 6);
  assert.equal(cards.bottle.power, 3);
  assert.equal(cards.ogdominican.power, 4);
  assert.equal(cards.leroy.cost, 3);
  assert.equal(cards.leroy.power, 4);
  assert.equal(cards.pinaynurse.effect.includes('+2 Hands'), true);
  assert.equal(cards.workboots.name, 'Buttahs');
  assert.equal(cards.workboots.effect.includes('+2 Hands'), true);
  assert.deepEqual([cards.hooper.cost, cards.hooper.power], [5, 5]);
  assert.deepEqual([cards.plug.cost, cards.plug.power], [1, 2]);
  assert.deepEqual([cards.honestthot.cost, cards.honestthot.power], [1, 2]);
  assert.deepEqual([cards.nail.cost, cards.nail.power], [2, 3]);
  assert.deepEqual([cards.subwaymap.cost, cards.subwaymap.power], [0, 0]);
  assert.deepEqual([cards.gothkid.cost, cards.gothkid.power], [2, 3]);
});

function setup(id: string, owner: Owner) {
  const source = unit(id, owner), ally = unit('plug', owner, 1), second = unit('cornball', owner, 2), item = unit('buspass', owner, 3);
  const enemy = unit('hooper', owner === 'player' ? 'cpu' : 'player', 4);
  const match: Match = { ...createMatch('block', 'block'), phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 9, cpuMotion: 9,
    playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [], boards: [[ally, second, item, enemy], [], []] };
  return { source, ally, second, item, enemy, match };
}

for (const owner of ['player', 'cpu'] as const) test(`six support effects respect targets and Motion limits for ${owner}`, () => {
  for (const id of supportCardIds) {
    const { source, ally, second, item, enemy, match } = setup(id, owner);
    ally.statuses.frozen = true; second.statuses.silenced = true;
    const after = playTurnCard(match, owner, source.instanceId, 0);
    const find = (key: string) => after.boards.flat().find(c => c.instanceId === key)!;
    const motion = owner === 'player' ? after.playerMotion : after.cpuMotion;
    if (id === 'energydrink' || id === 'charger') assert.equal(motion, MAX_MOTION);
    if (id === 'firstaid') { assert.equal(find(ally.instanceId).statuses.frozen, false); assert.equal(find(second.instanceId).statuses.silenced, false); }
    if (id === 'boombox') { assert.equal(find(ally.instanceId).powerModifier, 1); assert.equal(find(second.instanceId).powerModifier, 1); }
    if (id === 'subwaymap') { assert.equal(find(ally.instanceId).lane, 1); assert.equal(find(ally.instanceId).powerModifier, 1); }
    if (id === 'workboots') { assert.equal(find(ally.instanceId).statuses.protected, true); assert.equal(find(ally.instanceId).powerModifier, 2); assert.equal(after.timedEffects.at(-1)?.targetInstanceId, ally.instanceId); }
    assert.equal(find(item.instanceId).powerModifier, 0);
    assert.equal(find(enemy.instanceId).powerModifier, 0);
    const event = after.effectLog.find(e => e.type === 'ability')!;
    assert(event); assert.equal(event.replay.after.playerMotion, after.playerMotion);
  }
});

test('support conditions and status suppression prevent free effects', () => {
  for (const id of supportCardIds) for (const status of ['frozen', 'silenced'] as const) {
    const { source, match } = setup(id, 'player'); source.statuses[status] = true;
    const after = playTurnCard(match, 'player', source.instanceId, 0);
    assert.equal(after.playerMotion, 9 - cards[id].cost);
    assert(after.boards.flat().every(c => c.powerModifier === 0));
  }
  const { source, match } = setup('charger', 'player');
  match.boards = [[unit('buspass', 'player')], [], []];
  assert.equal(playTurnCard(match, 'player', source.instanceId, 0).playerMotion, 9);
});

test('a coached Subway Map cannot award Hands when County Jail blocks its move', () => {
  const locations = ['county-jail', 'bodega', 'the-trap'].map(id => ({ ...DISTRICT_CATALOG.find(d => d.id === id)! })) as DistrictSnapshot['locations'];
  const upgrades = createAbilityUpgradeSnapshot(crew, crew, { player: { 'subway-map': { xp: 4500, level: 10, moveTier: 3 } } });
  let m = createMatchFromEngineCards('supports', crew, 'rival', crew, undefined, undefined, upgrades, { version: 1, locations });
  const ally = m.playerHand.find(c => c.cardId === 'cornball')!;
  m = playTurnCard(m, 'player', ally.instanceId, 0);
  const source = unit('subwaymap', 'player', 12);
  const after = playTurnCard({ ...m, playerMotion: 9, playerHand: [source] }, 'player', source.instanceId, 0);
  const result = after.boards.flat().find(c => c.instanceId === ally.instanceId)!;
  assert.equal(result.lane, 0); assert.equal(result.powerModifier, 0);
  assert.equal(after.effectLog.some(e => e.abilityMetadata?.sourceCardId === 'subwaymap'), false);
});

test('ten-card gangs draw all ten by round six and reject seven-card submissions', () => {
  assert.equal(DECK_SIZE, 10);
  assert.throws(() => createMatchFromEngineCards('p', crew.slice(0, 7), 'c', crew), /ten unique/);
  assert.throws(() => createMatchFromEngineCards('p', crew, 'c', crew.slice(0, 7)), /ten unique/);
  let m = createMatchFromEngineCards('p', crew, 'c', crew);
  assert.equal(m.playerHand.length, 5);
  while (m.round < 6) m = nextRound(pass(pass(m, 'player'), 'cpu'));
  assert.equal(m.playerHand.length, 10); assert.equal(m.playerDrawIndex, 10);
  assert.equal(m.playerMotion, 7, 'round six retains one unspent Motion above the old cap');
  const energy = m.playerHand.find(c => c.cardId === 'energydrink')!;
  assert.equal(playTurnCard(m, 'player', energy.instanceId, 0).playerMotion, 9);
  const catalog = crew.map(id => cards[id].id);
  assert(validateSavedDeck(catalog, catalog, catalog[0]).valid);
  assert(SavePlayerDeckBody.safeParse({ name: 'Support Gang', cardIds: catalog, heroCardId: catalog[0], recipeId: null }).success);
  assert(!SavePlayerDeckBody.safeParse({ name: 'Too Many', cardIds: [...catalog, 'guap'], heroCardId: catalog[0], recipeId: null }).success);
  const picks = draftOffers('2026-09-14').map(o => o[0]);
  assert.equal(picks.length, 10); assert(validateDraft('2026-09-14', picks));
  assert(StartPlayerMatchBody.safeParse({ mode: 'practice', playerDeckId: 'p', rivalDeckId: 'block', activity: 'draft', draftPicks: picks }).success);
});

test('legacy gang completion preserves order and only uses owned cards', () => {
  const owned = cardCatalog.map(c => c.catalogId), old = crew.slice(0, 7).map(id => cards[id].id);
  const migrated = upgradeLegacySavedDeck(old, owned);
  assert.equal(migrated.length, 10); assert.deepEqual(migrated.slice(0, 7), old); assert.equal(new Set(migrated).size, 10);
  assert.deepEqual(upgradeLegacySavedDeck(old, old), old);
  assert.deepEqual(upgradeLegacySavedDeck(old.slice(0, 6), owned), old.slice(0, 6));
  assert.deepEqual(upgradeLegacySavedDeck(migrated, owned), migrated);
});

test('story Motion boosts and starting resources respect the nine-point cap', () => {
  const encounter = makeActivityEncounter('boss', 'supports', 'block', '2026-09-14');
  const m = createStoryMatch({ ...encounter, modifiers: { startingMotion: { player: 30, cpu: 9 } } }, crew);
  assert.equal(m.playerMotion, 9); assert.equal(m.cpuMotion, 9);
});

test('discounted Motion refunds cannot exceed nine, and Work Boots blocks exactly one hostile hit', () => {
  for (const id of ['energydrink', 'charger', 'waterboy', 'nightcashier']) for (const owner of ['player', 'cpu'] as const) {
    const { source, match } = setup(id, owner); source.cost = 0; match.round = 5;
    const after = playTurnCard(match, owner, source.instanceId, 0);
    assert.equal(owner === 'player' ? after.playerMotion : after.cpuMotion, 9, `${id}/${owner}`);
  }
  const { source, ally, match } = setup('workboots', 'player');
  match.boards = [[ally], [], []];
  let after = playTurnCard(match, 'player', source.instanceId, 0);
  for (let i = 0; i < 2; i++) {
    const hostile = unit('nerd', 'cpu', 10 + i);
    after = playTurnCard({ ...after, phase: 'cpu-reveal', cpuMotion: 9, cpuHand: [hostile] }, 'cpu', hostile.instanceId, 0);
    assert.equal(after.boards[0].find(c => c.instanceId === ally.instanceId)?.statuses.silenced, i === 1);
  }
});

test('support gangs complete and replay the same fade; missing videos use the effects fallback', () => {
  let m = createMatchFromEngineCards('supports', crew, 'block', createMatch('block', 'block').cpuCardIds);
  const initial = m, moves: PlayerMove[] = [];
  while (m.phase !== 'complete') {
    const card = m.playerHand.find(c => c.cost <= m.playerMotion);
    if (card) { moves.push({ endTurn: false, cardInstanceId: card.instanceId, lane: 0, squabble: false }); m = playTurnCard(m, 'player', card.instanceId, 0); }
    else { moves.push({ endTurn: true, cardInstanceId: null, lane: null, squabble: false }); m = nextRound(revealCpuTurn(pass(m, 'player'))); }
  }
  const replay = verifyMatchTranscript('supports', 'block', moves, initial.abilityUpgradeSnapshot, crew);
  assert.deepEqual(replay, m);
  for (const id of supportCardIds) { assert.equal(moveAssignments[id], null); assert.equal(resolveSpecialMove(id), null); }
});
