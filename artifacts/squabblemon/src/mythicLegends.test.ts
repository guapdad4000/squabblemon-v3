import assert from 'node:assert/strict';
import test from 'node:test';
import { MYTHIC_LEGENDS } from '../../../lib/squabblemon-engine/src/mythicLegends';
import { cardCatalog, cards, validateCardAbilityUpgrades } from './data';
import {
  canAffordSelection, createCardInstance, createMatch, createMatchFromEngineCards, getLegalCardCost,
  nextRound, pass, playCard, playTurnCard, revealCpuTurn, verifyMatchTranscript,
  type CardInstance, type Lane, type Match, type Owner, type PlayerMove,
} from './gameEngine';
import { generateStreetPack } from '../../api-server/src/lib/collectionEconomy';

const unit = (id: string, owner: Owner, index: number, lane: Lane = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'legend', index), lane,
});
function setup(id: string, owner: Owner = 'player') {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  const source = unit(id, owner, 0);
  const ally = { ...unit('cornball', owner, 1), basePower: 2 };
  const second = { ...unit('plug', owner, 2), basePower: 3 };
  const third = { ...unit('church', owner, 3), basePower: 4 };
  const foe = { ...unit('hooper', enemy, 4), basePower: 8, powerModifier: 2 };
  const remoteA = unit('cornball', owner, 5, 1);
  const remoteB = unit('plug', owner, 6, 2);
  const m: Match = {
    ...createMatch('vibes', 'vibes'), round: 5, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: 9, cpuMotion: 9, playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [],
    boards: [[ally, second, third, foe], [remoteA], [remoteB]],
  };
  return { m, source, ally, second, third, foe, remoteA, remoteB, owner, enemy };
}
const onBoard = (m: Match, card: CardInstance) => m.boards.flat().find(c => c.instanceId === card.instanceId)!;

test('six new City Legends have art identities, pack access and bounded training paths', () => {
  assert.equal(MYTHIC_LEGENDS.length, 6);
  validateCardAbilityUpgrades();
  const rarityByFighter: Record<string, string> = {
    dragonflyjones: 'Common',
    shonuff: 'Rare',
    yasuke: 'Rare',
    mansamusa: 'Legendary',
    tron: 'Uncommon',
    johnhenry: 'Rare',
  };
  for (const [id, artworkId, name] of MYTHIC_LEGENDS) {
    const card = cardCatalog.find(c => c.engineId === id)!;
    assert.equal(card.name, name);
    assert.equal(card.artworkId, artworkId);
    assert.equal(card.rarity, rarityByFighter[id], `${id} should be ${rarityByFighter[id]}`);
    assert.equal(card.faction, 'City Legends');
    assert.equal(card.abilityUpgrades.length, 3);
    const owned = cardCatalog.filter(c => c.engineId !== id).map(c => c.catalogId);
    const pack = generateStreetPack({ ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0 }, () => 0);
    assert.equal(pack.rewards[0].cardId, artworkId);
  }
});

test('the four requested Motion prices and Dragonfly Jones Hands are printed on playable cards', () => {
  assert.deepEqual([cards.dragonflyjones.cost, cards.dragonflyjones.power], [2, 3]);
  assert.equal(cards.shonuff.cost, 3);
  assert.equal(cards.yasuke.cost, 2);
  assert.equal(cards.tron.cost, 3);
});

for (const owner of ['player', 'cpu'] as const) test(`all six Mythical reveals resolve for ${owner}`, () => {
  for (const [id] of MYTHIC_LEGENDS) {
    const { m, source, ally, second, third, foe, remoteA, remoteB } = setup(id, owner);
    const after = playCard(m, owner, source.instanceId, 0);
    const self = onBoard(after, source);
    const rival = onBoard(after, foe);
    if (id === 'dragonflyjones') { assert.equal(self.powerModifier, 1); assert.equal(rival.powerModifier, 0); }
    if (id === 'shonuff') { assert.equal(self.powerModifier, 2); assert.equal(rival.powerModifier, 0); }
    if (id === 'yasuke') { assert.equal(onBoard(after, ally).statuses.protected, true); assert.equal(rival.powerModifier, 1); }
    if (id === 'mansamusa') {
      assert.equal(onBoard(after, ally).powerModifier, 1);
      assert.equal(onBoard(after, remoteA).powerModifier, 1);
      assert.equal(onBoard(after, remoteB).powerModifier, 1);
      assert.equal(getLegalCardCost(after, owner, createCardInstance('hooper', owner), 1), cards.hooper.cost - 1);
      assert.equal(getLegalCardCost(after, owner, createCardInstance('hooper', owner), 0), cards.hooper.cost);
    }
    if (id === 'tron') {
      for (const card of [ally, second, third]) assert.equal(onBoard(after, card).powerModifier, 1);
      assert.equal(after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 9 - cards.tron.cost + 1);
    }
    if (id === 'johnhenry') { assert.equal(self.powerModifier, 3); assert.equal(rival.powerModifier, 1); }
  }
});

test('new effects respect conditions, guard and direct protection', () => {
  const dragonfly = setup('dragonflyjones');
  dragonfly.m.boards[0] = dragonfly.m.boards[0].filter(c => c.instanceId !== dragonfly.foe.instanceId);
  const unopposed = playCard(dragonfly.m, 'player', dragonfly.source.instanceId, 0);
  assert.equal(onBoard(unopposed, dragonfly.source).powerModifier, 1);

  const shonuff = setup('shonuff');
  shonuff.foe.powerModifier = 0;
  const noBoost = playCard(shonuff.m, 'player', shonuff.source.instanceId, 0);
  assert.equal(onBoard(noBoost, shonuff.source).powerModifier, 0);
  assert.equal(onBoard(noBoost, shonuff.foe).powerModifier, -1);
  const guard = unit('wifey', 'cpu', 8);
  guard.statuses.protected = true;
  shonuff.foe.powerModifier = 2;
  shonuff.m.boards[0].push(guard);
  const guarded = playCard(shonuff.m, 'player', shonuff.source.instanceId, 0);
  assert.equal(onBoard(guarded, shonuff.source).powerModifier, 0);
  assert.equal(onBoard(guarded, shonuff.foe).powerModifier, 2);
  assert.equal(onBoard(guarded, guard).statuses.blocked, true);

  const yasuke = setup('yasuke');
  let protectedBoard = playCard(yasuke.m, 'player', yasuke.source.instanceId, 0);
  const attacker = createCardInstance('honestthot', 'cpu', 'legend', 9);
  protectedBoard = playCard({ ...protectedBoard, phase: 'cpu-reveal', cpuMotion: 9, cpuHand: [attacker] }, 'cpu', attacker.instanceId, 0);
  assert.equal(onBoard(protectedBoard, yasuke.ally).statuses.silenced, false);
  assert.equal(protectedBoard.timedEffects.some(e => e.targetInstanceId === yasuke.ally.instanceId && e.kind === 'church-protection'), false);

  const tron = setup('tron');
  tron.m.boards[0] = [tron.ally];
  const oneFriend = playCard(tron.m, 'player', tron.source.instanceId, 0);
  assert.equal(onBoard(oneFriend, tron.ally).powerModifier, 1);
  assert.equal(oneFriend.playerMotion, 9 - cards.tron.cost);

  const john = setup('johnhenry');
  john.m.boards[0] = [john.ally, john.foe];
  const smallCrew = playCard(john.m, 'player', john.source.instanceId, 0);
  assert.equal(onBoard(smallCrew, john.source).powerModifier, 1);
  assert.equal(onBoard(smallCrew, john.foe).powerModifier, 2);
});

test('all six new Mythicals can play and replay in a complete match', () => {
  const ids = [...MYTHIC_LEGENDS.map(([id]) => id), 'leroy', 'cornball', 'plug', 'wifey'];
  const rival = createMatch('vibes', 'vibes');
  let match = createMatchFromEngineCards('mythic-legends', ids, 'vibes', rival.cpuCardIds);
  const start = match;
  const moves: PlayerMove[] = [];
  while (match.phase !== 'complete') {
    for (const card of [...match.playerHand]) {
      const lane = ([0, 1, 2] as Lane[]).find(value => canAffordSelection(match, 'player', card.instanceId, value));
      if (lane === undefined) continue;
      moves.push({ cardInstanceId: card.instanceId, lane, squabble: false, endTurn: false });
      match = playTurnCard(match, 'player', card.instanceId, lane);
    }
    moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
    match = nextRound(revealCpuTurn(pass(match, 'player')));
  }
  assert.deepEqual(verifyMatchTranscript('mythic-legends', 'vibes', moves, start.abilityUpgradeSnapshot, ids), match);
});
