import { completeEngineCrew } from '@workspace/squabblemon-engine/data';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, cards, catalogCardByEngineId, validateSavedDeck, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatchFromEngineCards, getLegalCardCost, nextRound, playCard, type CardInstance, type Lane, type Match } from './gameEngine';
import { resolveSpecialMove } from './specialMoves';
import { generateStreetPack } from '../../api-server/src/lib/collectionEconomy';

const refreshed = ['rastamon', 'gamer', 'bikelife', 'bossbabe', 'oink', 'barber', 'bottle', 'sneaker', 'church', 'wifey', 'scammer'];
const added = ['youngbull', 'transplant', 'tayaty', 'edgar', 'nguyen', 'manman', 'pinaynurse', 'honestthot', 'earthy', 'abuela', 'icecream'];
const crew = completeEngineCrew(['bossbabe', 'scammer', 'cornball', 'hooper', 'nguyen', 'abuela', 'icecream']);
const start = () => ({ ...createMatchFromEngineCards('refresh', crew, 'rival', crew), playerMotion: 30, cpuMotion: 30 });
const boardCard = (id: string, owner: 'player' | 'cpu' = 'cpu'): CardInstance => ({ ...createCardInstance(id, owner, 'target'), lane: 0 });
function play(match: Match, id: string, lane: Lane = 0): Match {
  const source = createCardInstance(id, 'player', 'followup', match.nextEventSequence);
  return playCard({ ...match, phase: 'player', playerMotion: 30, playerHand: [source] }, 'player', source.instanceId, lane);
}

test('all eleven refreshes and eleven new cards resolve through collection, deck, upgrades, and move assignments', () => {
  validateCardAbilityUpgrades();
  for (const id of [...refreshed, ...added]) {
    const entry = catalogCardByEngineId[id];
    assert(entry, `${id} is playable`);
    assert.equal(entry.artworkId, cards[id].id);
    const deck = [id, ...crew.filter(other => other !== id)].slice(0, 10).map(key => cards[key].id);
    assert.equal(validateSavedDeck(deck, cardCatalog.map(c => c.catalogId), deck[0]).valid, true, id);
  }
  for (const id of ['bossbabe', 'scammer', ...added]) {
    const entry = catalogCardByEngineId[id];
    const owned = cardCatalog.filter(c => c.engineId !== id).map(c => c.catalogId);
    const pack = generateStreetPack({ ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0 }, () => 0);
    assert.equal(pack.rewards[0].cardId, entry.catalogId, `${id} is obtainable`);
  }
  assert.equal(resolveSpecialMove('boss-babe')?.id, 'char16');
  for (const id of ['scammer', 'nguyen', 'manman', 'pinaynurse', 'honestthot', 'earthy', 'abuela', 'icecream']) {
    assert.ok(resolveSpecialMove(id), `${id} has its delivered Wave 3 video`);
  }
});

test('Network Boost counts two plays elsewhere, then discounts exactly one card costing four or more', () => {
  let m = play(start(), 'bossbabe');
  m = play(m, 'cornball');
  assert.equal(m.boards[0][0].networkBoosts, undefined);
  m = play(m, 'cornball', 1);
  m = play(m, 'cornball', 2);
  assert.equal(m.boards[0][0].networkBoosts, 2);
  assert.equal(m.boards[0][0].powerModifier, 2);
  assert.equal(m.discountTokens.length, 1);
  assert.equal(getLegalCardCost(m, 'player', createCardInstance('nguyen', 'player'), 1), 2);
  assert.equal(getLegalCardCost(m, 'player', createCardInstance('hooper', 'player'), 1), cards.hooper.cost - 1);
  m = play(m, 'nguyen', 1);
  assert.equal(m.discountTokens.length, 1);
  m = play(m, 'hooper', 1);
  assert.equal(m.discountTokens.length, 0);
  assert.equal(m.boards[0][0].powerModifier, 2);
  assert.equal(getLegalCardCost(m, 'player', createCardInstance('hooper', 'player'), 2), cards.hooper.cost);
  const triggered = m.effectLog.filter(e => e.cardId === 'bossbabe' && e.note.includes('gained +1 Hands'));
  assert.equal(triggered.length, 2);
  assert.equal(triggered[1].replay.after.boards[0][0].networkBoosts, 2);
});

test('silenced or frozen Boss Bae cannot trigger Network Boost', () => {
  for (const status of ['silenced', 'frozen'] as const) {
    const boss = boardCard('bossbabe', 'player');
    boss.statuses[status] = true;
    const m = play({ ...start(), boards: [[boss], [], []] }, 'cornball', 1);
    assert.equal(m.boards[0][0].powerModifier, 0);
    assert.equal(m.discountTokens.length, 0);
  }
});

test('Imposter copies capped base Hands and printed ability without firing an On Reveal or replacing artwork', () => {
  const target = { ...boardCard('oink'), basePower: 10, powerModifier: 3 };
  const m = play({ ...start(), boards: [[target], [], []] }, 'scammer');
  const scammer = m.boards[0].find(c => c.cardId === 'scammer')!;
  assert.equal(scammer.basePower, 7);
  assert.equal(scammer.powerModifier, 0);
  assert.equal(scammer.copiedAbilityCardId, 'oink');
  assert.equal(scammer.ability, cards.oink.ability);
  assert.equal(scammer.id, 'scammer');
  assert.equal(m.boards[0][0].powerModifier, 3);
  assert.equal(m.effectLog.filter(e => e.type === 'ability').length, 1);
  assert.equal(m.effectLog.at(-1)?.replay.after.boards[0].find(c => c.cardId === 'scammer')?.copiedAbilityCardId, 'oink');
  assert.equal(play(start(), 'scammer').boards[0][0].copiedAbilityCardId, undefined);
});

test('copied Gamer and Boss Bae passives work on subsequent plays and respect silence', () => {
  let m = play({ ...start(), boards: [[boardCard('gamer')], [], []] }, 'scammer');
  m = play(m, 'cornball');
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.powerModifier, 1);
  assert.equal(m.boards[0].find(c => c.cardId === 'cornball')?.powerModifier, 1);
  m = { ...m, boards: m.boards.map(items => items.map(c => c.cardId === 'scammer' ? { ...c, statuses: { ...c.statuses, silenced: true } } : c)) as Match['boards'] };
  m = play(m, 'cornball');
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.powerModifier, 1);
  m = play({ ...start(), boards: [[boardCard('bossbabe')], [], []] }, 'scammer');
  m = play(m, 'cornball', 1);
  m = play(m, 'cornball', 2);
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.networkBoosts, 2);
  assert.equal(m.discountTokens[0].eligibility, 'printed-four-plus');
});

test('copied Landlord, Sneaker Reseller, and Wifey passives remain active', () => {
  let m = play({ ...start(), boards: [[boardCard('landlord')], [], []] }, 'scammer');
  assert.equal(getLegalCardCost(m, 'cpu', createCardInstance('cornball', 'cpu'), 0), 2);
  m = play({ ...start(), boards: [[boardCard('sneaker')], [], []] }, 'scammer');
  const threat = createCardInstance('hooper', 'cpu', 'incoming');
  m = playCard({ ...m, phase: 'cpu-reveal', cpuHand: [threat] }, 'cpu', threat.instanceId, 1);
  assert.equal(m.discountTokens.find(t => t.owner === 'player')?.eligibility, 'any');
  m = play({ ...start(), boards: [[boardCard('wifey')], [], []] }, 'scammer');
  m = nextRound({ ...m, phase: 'resolved' });
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.statuses.protected, true);
  const disruptor = createCardInstance('honestthot', 'cpu', 'hostile');
  m = playCard({ ...m, phase: 'cpu-reveal', cpuHand: [disruptor], cpuMotion: 30 }, 'cpu', disruptor.instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.statuses.silenced, false);
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.statuses.blocked, true);
});

test('copied Wifey protection prevents Cornball movement as well as direct disruption', () => {
  let m = play({ ...start(), boards: [[boardCard('wifey')], [], []] }, 'scammer');
  m = { ...m, boards: [[...m.boards[0], boardCard('earthy', 'player'), boardCard('nguyen', 'player')], [], []] };
  m = nextRound({ ...m, phase: 'resolved' });
  const cornball = createCardInstance('cornball', 'cpu', 'hostile');
  m = playCard({ ...m, phase: 'cpu-reveal', cpuHand: [cornball], cpuMotion: 30 }, 'cpu', cornball.instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'earthy')?.lane, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.statuses.blocked, true);
});

test('new card move tiers remain bounded, do not repeat with passive triggers, and need a successful copy', () => {
  const match = createMatchFromEngineCards('refresh', crew, 'rival', crew, undefined,
    { player: { bossbabe: { xp: 2800, level: 8, moveTier: 3 }, scammer: { xp: 2800, level: 8, moveTier: 3 } } });
  let m = play(match, 'bossbabe');
  assert.equal(m.boards[0][0].powerModifier, 3);
  m = play(m, 'cornball', 1);
  assert.equal(m.boards[0][0].powerModifier, 4);
  assert.equal(m.effectLog.filter(e => e.abilityMetadata?.sourceCardId === 'bossbabe').length, 3);
  assert.equal(play(match, 'scammer').boards[0][0].powerModifier, 0);
  m = play({ ...match, boards: [[boardCard('gamer')], [], []] }, 'scammer');
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.powerModifier, 3);
  const silenced = createCardInstance('scammer', 'player');
  silenced.statuses.silenced = true;
  m = playCard({ ...match, playerHand: [silenced], playerMotion: 30, boards: [[boardCard('gamer')], [], []] }, 'player', silenced.instanceId, 0);
  assert.equal(m.boards[0].find(c => c.cardId === 'scammer')?.copiedAbilityCardId, undefined);
});
