import assert from 'node:assert/strict';
import test from 'node:test';
import { MYTHIC_LEGENDS } from '../../../lib/squabblemon-engine/src/mythicLegends';
import { cardCatalog, cards, validateCardAbilityUpgrades } from './data';
import {
  canAffordSelection, createCardInstance, createMatch, createMatchFromEngineCards, getLegalCardCost,
  createAbilityUpgradeSnapshot, nextRound, pass, playCard, playTurnCard, revealCpuTurn, verifyMatchTranscript,
  type CardInstance, type Lane, type Match, type Owner, type PlayerMove,
} from './gameEngine';
import { generateStreetPack } from '../../api-server/src/lib/collectionEconomy';

const packRngFor = (rarity: string, tierIndex = 0) => {
  const rarityThreshold: Record<string, number> = {
    SuperCommon: 0, Common: 4000, Uncommon: 6000, Rare: 8500,
    Epic: 9700, Legendary: 9900, Mythical: 9980,
  };
  let call = 0;
  return () => call++ === 0 ? rarityThreshold[rarity] : call === 2 ? tierIndex : 0;
};

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

test('nine City Legends have art identities, pack access and bounded training paths', () => {
  assert.equal(MYTHIC_LEGENDS.length, 9);
  validateCardAbilityUpgrades();
  const rarityByFighter: Record<string, string> = {
    dragonflyjones: 'Legendary',
    shonuff: 'Legendary',
    yasuke: 'Mythical',
    mansamusa: 'Legendary',
    tron: 'Legendary',
    johnhenry: 'Mythical',
    ashlee: 'Mythical',
    captainjigga: 'Mythical',
    counter: 'Mythical',
  };
  for (const [id, artworkId, name] of MYTHIC_LEGENDS) {
    const card = cardCatalog.find(c => c.engineId === id)!;
    assert.equal(card.name, name);
    assert.equal(card.artworkId, artworkId);
    assert.equal(card.rarity, rarityByFighter[id], `${id} should be ${rarityByFighter[id]}`);
    assert.equal(card.faction, 'City Legends');
    assert.equal(card.abilityUpgrades.length, 3);
    const owned = cardCatalog.filter(c => c.engineId !== id).map(c => c.catalogId);
    const pack = generateStreetPack({ ownedCardIds: owned, discoveredCardIds: owned, ownedVariants: [], pity: 0 }, packRngFor(card.rarity));
    assert.equal(pack.rewards[0].cardId, artworkId);
  }
});

test('City Legend Motion prices and Dragonfly Jones Hands are printed on playable cards', () => {
  assert.deepEqual([cards.dragonflyjones.cost, cards.dragonflyjones.power], [2, 3]);
  assert.equal(cards.shonuff.cost, 3);
  assert.equal(cards.yasuke.cost, 2);
  assert.equal(cards.tron.cost, 3);
  assert.match(cards.tron.effect, /If all three gained Hands, restore 1 Motion/);
  assert.equal(cards.ashlee.cost, 5);
  assert.equal(cards.ashlee.power, 3);
  assert.equal(cards.captainjigga.cost, 5);
  assert.equal(cards.counter.cost, 4);
  assert.equal(cards.counter.power, 3);
});
for (const owner of ['player', 'cpu'] as const) test(`TRON buffs two without refund, three with refund, even through Protection (${owner})`, () => {
  const motion = owner === 'player' ? 'playerMotion' : 'cpuMotion';
  const two = setup('tron', owner);
  two.ally.statuses.protected = true;
  two.m.boards[0] = [two.ally, two.second];
  const noRefund = playCard(two.m, owner, two.source.instanceId, 0);
  assert.equal(onBoard(noRefund, two.ally).powerModifier, 1);
  assert.equal(onBoard(noRefund, two.second).powerModifier, 1);
  assert(onBoard(noRefund, two.ally).statuses.protected);
  assert.equal(noRefund[motion], 9 - cards.tron.cost);
  assert(!noRefund.effectLog.some(e => e.note.includes('For the Hood helped 2 characters and restored')));

  const three = setup('tron', owner);
  three.ally.statuses.protected = true;
  const refunded = playCard(three.m, owner, three.source.instanceId, 0);
  for (const ally of [three.ally, three.second, three.third]) assert.equal(onBoard(refunded, ally).powerModifier, 1);
  assert(onBoard(refunded, three.ally).statuses.protected);
  assert.equal(refunded[motion], 9 - cards.tron.cost + 1);
  assert(refunded.effectLog.some(e => e.note.includes('For the Hood helped 3 characters and restored up to 1 Motion')));

  const capped = setup('tron', owner);
  capped.source.cost = 1;
  capped.m.plugDiscountLane = { ...capped.m.plugDiscountLane, [owner]: 1 };
  assert.equal(getLegalCardCost(capped.m, owner, capped.source, 0), 0);
  const atCap = playCard(capped.m, owner, capped.source.instanceId, 0);
  assert.equal(atCap[motion], 9, 'zero-cost placement cannot refund above the Motion cap');
  for (const ally of [capped.ally, capped.second, capped.third]) assert.equal(onBoard(atCap, ally).powerModifier, 1);
});

for (const owner of ['player', 'cpu'] as const) test(`all nine City Legend reveals resolve for ${owner}`, () => {
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
    if (id === 'johnhenry') { assert.equal(self.powerModifier, 0); assert.equal(rival.powerModifier, 2); }
    if (id === 'ashlee') {
      for (const card of [ally, second, third]) assert.equal(onBoard(after, card).powerModifier, 1);
      assert.equal(rival.powerModifier, 1);
      const guyana = after.boards.flat().filter(card => card.cardId === 'guyana' && card.owner === owner);
      assert.equal(guyana.length, 1);
      assert.equal(guyana[0].basePower, 4);
      assert.equal(guyana[0].statuses.uncounterable, true);
      const event = after.effectLog.find(entry => entry.type === 'ability' && entry.cardId === 'ashlee' && !entry.abilityMetadata)!;
      assert.equal(event.targets.find(target => target.cardInstanceId === foe.instanceId)?.after?.powerModifier, 1);
    }
    if (id === 'captainjigga') {
      const stewards = after.boards.flat().filter(card => card.cardId === 'steward' && card.owner === owner);
      assert.equal(stewards.length, 2);
      assert.equal(new Set(stewards.map(card => card.instanceId)).size, 2, 'each summon must have a unique instance id');
      assert(stewards.every(card => card.basePower === 2));
      assert.equal(rival.powerModifier, 0, 'one enemy can only be targeted by one Steward');
    }
    if (id === 'counter') {
      assert.equal(self.powerModifier, 0);
      assert.equal(rival.powerModifier, 0, 'Shotta fires for 2 instead of copying cost');
      assert.equal(self.statuses.protected, false);
    }
  }
});

test('Goth Kid safely evaluates Ashlee and Captain Jigga summon costs', () => {
  for (const [legendId, tokenId] of [['ashlee', 'guyana'], ['captainjigga', 'steward']] as const) {
    const legend = setup(legendId);
    let summoned = playCard(legend.m, 'player', legend.source.instanceId, 0);
    summoned = {
      ...summoned,
      boards: summoned.boards.map(lane =>
        lane.filter(card => card.owner === 'player' && card.cardId === tokenId),
      ),
    };
    const tokens = summoned.boards.flat();
    assert(tokens.length > 0, `${legendId} must summon ${tokenId}`);

    const goth = unit('gothkid', 'cpu', 90);
    const after = playTurnCard({
      ...summoned,
      phase: 'cpu-reveal',
      cpuMotion: 9,
      cpuHand: [goth],
    }, 'cpu', goth.instanceId, 0);
    const resolvedTokens = after.boards.flat().filter(card => card.cardId === tokenId);
    if (tokenId === 'guyana') {
      assert(resolvedTokens.every(card => card.statuses.uncounterable && !card.statuses.silenced));
    } else {
      assert(resolvedTokens.some(card => card.statuses.silenced));
    }
  }
});

test('trained Ashlee and Captain Jigga earn bounded upgrades from summon-only reveals', () => {
  for (const id of ['ashlee', 'captainjigga'] as const) {
    const { m, source } = setup(id);
    m.boards = [[], [], []];
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot([id], [], {
      player: { [id]: { xp: 2800, level: 8, moveTier: 3 } },
    });
    const after = playCard(m, 'player', source.instanceId, 0);
    assert.equal(onBoard(after, source).powerModifier, 2, `${id} applies its two self tiers`);
    assert.equal(after.effectLog.filter(event => event.abilityMetadata?.sourceCardId === id).length, 2);
    const tokenId = id === 'ashlee' ? 'guyana' : 'steward';
    assert.equal(after.boards.flat().filter(card => card.cardId === tokenId).length, id === 'ashlee' ? 1 : 2);
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
  const attacker = createCardInstance('gothkid', 'cpu', 'legend', 9);
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
  assert.equal(onBoard(smallCrew, john.source).powerModifier, 0);
  assert.equal(onBoard(smallCrew, john.foe).powerModifier, 2);
});

test('all six new Mythicals can play and replay in a complete fade', () => {
  const ids = [...MYTHIC_LEGENDS.map(([id]) => id), 'leroy'];
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
