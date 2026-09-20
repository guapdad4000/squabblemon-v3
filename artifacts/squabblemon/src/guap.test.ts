import { completeEngineCrew } from '@workspace/squabblemon-engine/data';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cardCatalog, cards, CARD_RARITIES, cardEntryAccent, validateCardAbilityUpgrades, validateSavedDeck } from './data';
import { createCardInstance, createMatch, createMatchFromEngineCards, playCard, playTurnCard, pass, revealCpuTurn, nextRound, canAffordSelection, verifyMatchTranscript, type Match, type Owner, type Lane, type PlayerMove } from './gameEngine';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { generateStreetPack } from '../../api-server/src/lib/collectionEconomy';
import { moveAssignments, resolveSpecialMove } from './specialMoves';

const crew = completeEngineCrew(['guap', 'cornball', 'plug', 'rastamon', 'snow', 'wifey', 'hooper']);
const unit = (id: string, owner: Owner, index: number, lane: Lane = 0) => ({ ...createCardInstance(id, owner, 'guap-test', index), lane });
function setup(owner: Owner = 'player') {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  const source = unit('guap', owner, 0);
  const ally = unit('plug', owner, 1);
  const foe = unit('hooper', enemy, 2);
  const fragile = unit('cornball', enemy, 3);
  const elsewhere = unit('hooper', enemy, 4, 1);
  const m: Match = { ...createMatch('vibes', 'vibes'), round: 6, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: 6, cpuMotion: 6, playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [],
    boards: [[ally, foe, fragile], [elsewhere], []] };
  return { m, source, ally, foe, fragile, elsewhere };
}

test('GUAP is a playable top-tier Mythical with pack access, three upgrades, and a replaceable video slot', () => {
  const card = cardCatalog.find(c => c.engineId === 'guap')!;
  assert.equal(card.name, 'GUAP'); assert.equal(card.artworkId, 'guap');
  assert.equal(card.rarity, CARD_RARITIES.at(-1));
  assert.equal(card.ability, 'FINNAM!'); assert.equal(card.cost, 6); assert.equal(card.power, 6);
  assert.equal(cardEntryAccent(card), '#f5c542');
  assert(card.acquisitionSources.includes('Street Packs'));
  validateCardAbilityUpgrades();
  assert.equal(validateSavedDeck(crew.map(id => cards[id].id), cardCatalog.map(c => c.catalogId), "guap").valid, true);
  const owned = cardCatalog.filter(c => c.engineId !== 'guap').map(c => c.catalogId);
  assert.equal(generateStreetPack({ ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0 }, () => 0).rewards[0].cardId, 'guap');
  assert.equal(moveAssignments.guap, 'char91');
  assert.equal(resolveSpecialMove('guap')?.id, 'char91');
  assert.equal(resolveSpecialMove('guap')?.move, 'FINNAM!');
  assert.equal(resolveSpecialMove('guap')?.startSeconds, 0);
  assert.equal(resolveSpecialMove('guap')?.durationMs, 6500);
  assert.equal(resolveSpecialMove('guap', {guap:null}), null);
  assert.equal(resolveSpecialMove('guap', {guap: 'char45'})?.id, 'char45');
});

for (const owner of ['player', 'cpu'] as const) test('FINNAM! charges GUAP and hits only enemies in his district for ' + owner, () => {
  const { m, source, ally, foe, fragile, elsewhere } = setup(owner);
  const after = playCard(m, owner, source.instanceId, 0);
  const find = (id: string) => after.boards.flat().find(c => c.instanceId === id);
  assert.equal(find(source.instanceId)?.powerModifier, 2);
  assert.equal(find(foe.instanceId)?.powerModifier, -1);
  assert.equal(find(fragile.instanceId), undefined, 'a one-Hands enemy is destroyed');
  assert.equal(find(ally.instanceId)?.powerModifier, 0);
  assert.equal(find(elsewhere.instanceId)?.powerModifier, 0);
  assert.equal(after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 0);
  const event = after.effectLog.find(e => e.type === 'ability' && e.cardInstanceId === source.instanceId)!;
  assert.equal(event.kind, 'fire'); assert.match(event.note, /FINNAM!/);
  assert.equal(event.source?.after?.powerModifier, 2);
  assert.deepEqual(event.targets.filter(t => t.cardInstanceId !== source.instanceId).map(t => t.cardInstanceId).sort(), [foe.instanceId, fragile.instanceId].sort());
});

test('FINNAM! respects protective effects and damage mitigation', () => {
  const { m, source, foe, fragile } = setup();
  fragile.basePower = 3;
  foe.statuses.protected = true;
  m.timedEffects = [
    {id:'guap-shield', kind:'church-protection', sourceInstanceId:'church-test', targetInstanceId:foe.instanceId, owner:'cpu', lane:0, startsAtRound:6, expiresAtRound:7, expiration:'match-complete'},
    {id:'guap-mitigation', kind:'nail-mitigation', sourceInstanceId:'nail-test', targetInstanceId:fragile.instanceId, owner:'cpu', lane:0, startsAtRound:6, expiresAtRound:7, expiration:'match-complete'},
  ];
  const after = playCard(m, 'player', source.instanceId, 0);
  for (const target of [foe, fragile]) assert.equal(after.boards[0].find(c => c.instanceId === target.instanceId)?.powerModifier, 0);
  assert.equal(after.timedEffects.length, 0);
  assert.equal(after.boards[0].find(c => c.cardId === 'guap')?.powerModifier, 2);
});

test('GUAP gains three training bonuses only after an unblocked ability', () => {
  for (const status of [null, 'frozen', 'silenced'] as const) {
    const { m, source } = setup();
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(crew, m.cpuCardIds, { player: {guap:{xp:4500,level:10,moveTier:3}} });
    if (status) source.statuses[status] = true;
    const before = structuredClone(m.boards);
    const after = playCard(m, 'player', source.instanceId, 0);
    assert.equal(after.boards[0].find(c => c.cardId === 'guap')?.powerModifier, status ? 0 : 5);
    if (status) assert.deepEqual(after.boards.map(board => board.filter(c => c.instanceId !== source.instanceId)), before);
  }
  const {m, source} = setup(); m.boards = [[],[],[]];
  assert.equal(playCard(m, 'player', source.instanceId, 0).boards[0][0].powerModifier, 2);
});

test('GUAP can finish a six-round gang battle and replay identically on the authoritative engine', () => {
  const rival = createMatch('vibes', 'vibes');
  let m = createMatchFromEngineCards('guap-crew', crew, 'vibes', rival.cpuCardIds);
  const start = m, moves: PlayerMove[] = [];
  while (m.phase !== 'complete') {
    for (const card of [...m.playerHand]) {
      const lane = ([0,1,2] as Lane[]).find(l => canAffordSelection(m, 'player', card.instanceId, l));
      if (lane === undefined) continue;
      moves.push({cardInstanceId:card.instanceId,lane,squabble:false,endTurn:false});
      m = playTurnCard(m, 'player', card.instanceId, lane);
    }
    moves.push({cardInstanceId:null,lane:null,squabble:false,endTurn:true});
    m = nextRound(revealCpuTurn(pass(m, 'player')));
  }
  assert(m.effectLog.some(e => e.type === 'ability' && e.cardId === 'guap'));
  assert.deepEqual(verifyMatchTranscript('guap-crew', 'vibes', moves, start.abilityUpgradeSnapshot, crew), m);
});
