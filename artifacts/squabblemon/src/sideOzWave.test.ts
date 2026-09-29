import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { SIDE_OZ_WAVE } from '../../../lib/squabblemon-engine/src/sideOzWave';
import { createDefaultBalanceDecks, simulateBalanceMatch, type BalanceDeck } from '@workspace/squabblemon-engine/balanceLab';
import { choosePackCardFromTier } from '../../../lib/squabblemon-engine/src/packRules';
import { STORY_CHARACTERS, storyContent } from '../../../lib/squabblemon-engine/src/story';
import { applyOnlineCommand, createOnlineRoom, joinOnlineRoom, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { cards, cardCatalog, catalogCardById, decks, DECK_SIZE, validateCardAbilityUpgrades, validateSavedDeck } from './data';
import { getAssetUrl, getCardImage } from './lib/assets';
import characterRevisions from './characterRevisions.json';
import { createAbilityUpgradeSnapshot, createCardInstance, createMatch, createMatchFromEngineCards,
  getEffectiveCardPower, getLegalCardCost, nextRound, pass, playTurnCard, revealCpuTurn, verifyMatchTranscript,
  type CardInstance, type Lane, type Match, type Owner, type PlayerMove } from './gameEngine';

const ids = SIDE_OZ_WAVE.map(([id]) => id);
const gangRarities = {
  redside1: 'Common', redside2: 'Legendary', redside3: 'Epic',
  redside4: 'Rare', redside5: 'Epic',
  blueside1: 'Legendary', blueside2: 'Uncommon', blueside3: 'Epic',
  blueside4: 'Epic', blueside5: 'Epic',
} as const;
const unit = (id: string, owner: Owner, lane: Lane, n = 1): CardInstance =>
  ({ ...createCardInstance(id, owner, 'side-oz', n), lane });
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9,
  playerHand: [], cpuHand: [], boards: [[], [], []] });
const find = (m: Match, id: string) => m.boards.flat().find(c => c.instanceId === id);
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0) {
  const source = createCardInstance(id, owner, 'side-oz-cast', m.nextEventSequence);
  const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
  return { source, after: playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [hand]: [source] }, owner, source.instanceId, lane, false) };
}
test('twelve individual cutouts are collectible and legal in ten-card owned crews', () => {
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  assert.equal(new Set(SIDE_OZ_WAVE.map(([, art]) => art)).size, 12);
  for (const [id, art, name, rarity, type, cost, power, ability, effect, , faction] of SIDE_OZ_WAVE) {
    const catalog = catalogCardById[art];
    assert.equal(catalog.engineId, id);
    assert.equal(catalog.name, name);
    assert.equal(catalog.rarity, rarity);
    assert.equal(catalog.type, type);
    assert.equal(catalog.faction, faction);
    assert(catalog.crewTags.includes(faction.toLowerCase().replaceAll(' ', '-')));
    assert(catalog.acquisitionSources.includes('Street Packs'));
    assert.equal(catalog.cost, cost);
    assert.equal(catalog.power, power);
    assert(cost >= 1 && cost <= 6 && power >= 1 && power <= cost + 1);
    assert.equal(catalog.ability, ability);
    assert.equal(catalog.effect, effect);
    assert(/^On Reveal(?: and each new round| and at the start of the next two rounds)?:/.test(catalog.effect), `${id} has no reveal trigger`);
    assert.equal(cards[id].abilityUpgrades.length, 3);
    assert.deepEqual(cards[id].abilityUpgrades.map(u => u.unlockLevel), [2, 5, 8]);
    validateCardAbilityUpgrades({ [id]: cards[id] });
    assert.equal(getCardImage(art), `/assets/characters/${art}.webp?v=${(characterRevisions as Record<string, string>)[art]}`);
    assert(existsSync(`public/assets/characters/${art}.webp`));
    const tier = cardCatalog.filter(c => c.rarity === rarity);
    assert.equal(choosePackCardFromTier({ rarity, tier, pulledCardIds: new Set(),
      ownedCardIds: new Set(tier.filter(c => c.catalogId !== art).map(c => c.catalogId)),
      protectNew: true, rng: () => 0 }).catalogId, art);
  }
  for (const crew of [SIDE_OZ_WAVE.slice(0, 10), SIDE_OZ_WAVE.slice(2)]) {
    const cardIds = crew.map(([, art]) => art);
    assert(validateSavedDeck(cardIds, cardIds, cardIds[0]).valid);
    assert(!validateSavedDeck(cardIds, cardIds.slice(1), cardIds[0]).valid);
  }
});

test('Red and Blue OGs are Legendary and the promoted crew cards use their collection tiers', () => {
  for (const [engineId, rarity] of Object.entries(gangRarities)) {
    const definition = SIDE_OZ_WAVE.find(([id]) => id === engineId)!;
    assert.equal(definition[3], rarity, `${definition[2]} has the wrong authored rarity`);
    assert.equal(catalogCardById[definition[1]].rarity, rarity, `${definition[2]} has the wrong collection rarity`);
  }
});

test('Ganger Red and Blue keep story identities but use revised masked portraits', () => {
  for (const [id, crew] of [['ganger-red', 'red-side'], ['ganger-blue', 'blue-side']] as const) {
    const entry = STORY_CHARACTERS.find(c => c.id === id)!;
    assert.equal(entry.crew, crew);
    assert.equal(entry.portraitAssetId, `assets/characters/${id}.webp`);
    assert.equal(getAssetUrl(entry.portraitAssetId),
      `/assets/characters/${id}.webp?v=${(characterRevisions as Record<string, string>)[id]}`);
    assert(existsSync(`public/${entry.portraitAssetId}`));
  }
  const chapter = storyContent.chapters[0];
  for (const node of chapter.nodes) {
    if (node.kind !== 'battle' || !['Ganger Red', 'Ganger Blue'].includes(node.encounter.enemy.name)) continue;
    assert.equal(node.encounter.enemy.portraitAssetId,
      `assets/characters/ganger-${node.encounter.enemy.name.endsWith('Red') ? 'red' : 'blue'}.webp`);
  }
});

for (const owner of ['player', 'cpu'] as const) {
  test(`all twelve revised abilities resolve deterministically for both owners (${owner})`, () => {
    for (const id of ids) {
      const m = blank(), enemy: Owner = owner === 'player' ? 'cpu' : 'player';
      const ally = unit('blueside2', owner, 0, 100), foe = unit('hooper', enemy, 0, 101);
      const distant = unit('hooper', enemy, 1, 102);
      foe.powerModifier = 5; distant.powerModifier = 5;
      m.boards = [[ally, foe], [distant], []];
      const saved = JSON.stringify(m), first = cast(m, id, owner).after;
      assert.equal(JSON.stringify(m), saved, `${id} mutated input`);
      assert.deepEqual(cast(JSON.parse(saved), id, owner).after, first, `${id} is not replay-safe`);
      assert(first.effectLog.some(e => e.type === 'ability' && e.cardId === id), id);
    }
  });
  test(`successful revised abilities still grant the three unlocked upgrades (${owner})`, () => {
    const crew = ids.slice(0, DECK_SIZE);
    for (const id of ids) {
      const m = blank(), enemy: Owner = owner === 'player' ? 'cpu' : 'player';
      m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(
        [id, ...crew.filter(cardId => cardId !== id)].slice(0, DECK_SIZE),
        [id, ...crew.filter(cardId => cardId !== id)].slice(0, DECK_SIZE), {
          player: { [id]: { level: 8, xp: 2800, moveTier: 3 } },
          cpu: { [id]: { level: 8, xp: 2800, moveTier: 3 } },
        });
      const foe = unit('hooper', enemy, 0, 112);
      foe.powerModifier = 3;
      m.boards = [[unit('cornball', owner, 0, 111), foe], [unit('hooper', enemy, 1, 113)], []];
      const { source, after } = cast(m, id, owner);
      assert.equal(after.effectLog.filter(e => e.abilityMetadata?.sourceCardId === id
        && e.abilityMetadata.result === 'applied').length, 3, `${id} lost its unlocked upgrades`);
      assert.equal(find(after, source.instanceId)?.waveTrainingUsed, true);
    }
  });
}

test('Red Plaid Petey earns Hands and discounts the next Red Side play only after moving', () => {
  const m = blank(), ally = unit('cornball', 'player', 0, 120);
  m.boards[0].push(ally);
  const { source, after } = cast(m, 'redside1');
  const runner = find(after, source.instanceId)!;
  assert.notEqual(runner.lane, 0);
  assert.equal(runner.powerModifier, 1);
  const nextRed = createCardInstance('redside2', 'player', 'test', 121);
  assert.equal(getLegalCardCost(after, 'player', nextRed, runner.lane!), Math.max(0, nextRed.cost - 1));
  const noMove = blank();
  noMove.boards[1] = [0, 1, 2, 3].map(n => unit('cornball', 'player', 1, 130 + n));
  noMove.boards[2] = [0, 1, 2, 3].map(n => unit('cornball', 'player', 2, 140 + n));
  const stuck = cast(noMove, 'redside1');
  assert.equal(find(stuck.after, stuck.source.instanceId)?.powerModifier, 0);
  assert.equal(getLegalCardCost(stuck.after, 'player', nextRed, 0), nextRed.cost,
    'a failed move does not earn the Red Side Motion discount');
});

test('Red OG steals one Hand; Ruby Shades fallback buffs self and weakens enemy', () => {
  const foe = unit('hooper', 'cpu', 0, 150);
  const hit = cast({ ...blank(), boards: [[foe], [], []] }, 'redside2');
  assert.equal(find(hit.after, foe.instanceId)?.powerModifier, -1);
  assert.equal(find(hit.after, hit.source.instanceId)?.powerModifier, 1);

  const hexTarget = unit('hooper', 'cpu', 0, 152);
  const hexer = cast({ ...blank(), boards: [[hexTarget], [], []] }, 'redside4');
  assert.equal(find(hexer.after, hexTarget.instanceId)?.statuses.weakened, true);

  const enemy = unit('hooper', 'cpu', 0, 151);
  const shade = cast({ ...blank(), boards: [[enemy], [], []] }, 'redside5');
  assert.equal(find(shade.after, shade.source.instanceId)?.powerModifier, 1);
  assert.equal(find(shade.after, enemy.instanceId)?.statuses.weakened, true);
});

for (const owner of ['player', 'cpu'] as const) {
  test(`OG Red Night takes one Hand per turn for at most three turns (${owner})`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    const foe = unit('hooper', enemy, 0, 301);
    foe.powerModifier = 5;
    const { source, after } = cast({ ...blank(), boards: [[foe], [], []] }, 'redside2', owner);
    assert.equal(find(after, source.instanceId)?.redNightStartRound, 3);
    assert.equal(find(after, foe.instanceId)?.powerModifier, 4);
    assert.equal(find(after, source.instanceId)?.powerModifier, 1);
    let current = after;
    for (const [turn, expected] of [[4, 2], [5, 3], [6, 3]] as const) {
      const next = nextRound({ ...current, phase: 'resolved' });
      assert.deepEqual(nextRound(JSON.parse(JSON.stringify({ ...current, phase: 'resolved' }))), next,
        'round-start steals survive serialization and replay');
      assert.equal(next.round, turn);
      assert.equal(find(next, foe.instanceId)?.powerModifier, 5 - expected);
      assert.equal(find(next, source.instanceId)?.powerModifier, expected);
      current = next;
    }
    assert.equal(current.effectLog.filter(event => event.cardInstanceId === source.instanceId
      && event.note.includes('stole 1 Hand from')).length, 3);
  });

  test(`OG Red Night falls back to another ally only when no enemy is here (${owner})`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    const ally = unit('hooper', owner, 0, 302);
    ally.powerModifier = 2;
    const fallback = cast({ ...blank(), boards: [[ally], [], []] }, 'redside2', owner);
    assert.equal(find(fallback.after, ally.instanceId)?.powerModifier, 1);
    assert.equal(find(fallback.after, fallback.source.instanceId)?.powerModifier, 1);
    const immuneFoe = unit('hooper', enemy, 0, 303);
    immuneFoe.statuses.uncounterable = true;
    const blocked = cast({ ...blank(), boards: [[ally, immuneFoe], [], []] }, 'redside2', owner);
    assert.equal(find(blocked.after, ally.instanceId)?.powerModifier, 2,
      'a blocked enemy is still present, so no ally is charged');
    assert.equal(find(blocked.after, blocked.source.instanceId)?.powerModifier, 0);
    const vulnerable = unit('hooper', enemy, 0, 306);
    const alternate = cast({ ...blank(), boards: [[ally, immuneFoe, vulnerable], [], []] }, 'redside2', owner);
    assert.equal(find(alternate.after, vulnerable.instanceId)?.powerModifier, -1,
      'a stealable enemy takes priority over an immune enemy and the fallback ally');
    assert.equal(find(alternate.after, ally.instanceId)?.powerModifier, 2);
    const lastHand = unit('hooper', owner, 0, 304);
    lastHand.powerModifier = 1 - lastHand.basePower;
    const noSpare = cast({ ...blank(), boards: [[lastHand], [], []] }, 'redside2', owner);
    assert.equal(find(noSpare.after, lastHand.instanceId)?.powerModifier, lastHand.powerModifier);
    assert.equal(find(noSpare.after, noSpare.source.instanceId)?.powerModifier, 0);
    const blue = unit('blueside1', owner, 0, 305);
    const immuneAlly = cast({ ...blank(), boards: [[blue], [], []] }, 'redside2', owner);
    assert.equal(find(immuneAlly.after, blue.instanceId)?.powerModifier, 0);
    assert.equal(find(immuneAlly.after, immuneAlly.source.instanceId)?.powerModifier, 0);
    const lateEnemy = unit('hooper', enemy, 0, 307);
    lateEnemy.powerModifier = 4;
    const noTarget = cast(blank(), 'redside2', owner);
    let missed = { ...noTarget.after, phase: 'resolved' as const };
    missed.boards[0].push(lateEnemy);
    missed = nextRound(missed);
    assert.equal(find(missed, lateEnemy.instanceId)?.powerModifier, 3);
    missed = nextRound({ ...missed, phase: 'resolved' });
    assert.equal(find(missed, lateEnemy.instanceId)?.powerModifier, 2);
    missed = nextRound({ ...missed, phase: 'resolved' });
    assert.equal(find(missed, lateEnemy.instanceId)?.powerModifier, 2,
      'the first turn counts toward the three-turn window even if nobody was available');
  });
}

test('Red Robber Check In hits once, and its deterministic summon never chains', () => {
  const outcomes = new Set<number>();
  let sawArrivalReduction = false;
  for (let sequence = 1; sequence <= 64; sequence++) {
    const foe = unit('hooper', 'cpu', 0, 160);
    const otherFoes = [unit('hooper', 'cpu', 1, 161), unit('hooper', 'cpu', 2, 162)];
    const m = { ...blank(), nextEventSequence: sequence, boards: [[foe], [otherFoes[0]], [otherFoes[1]]] as Match['boards'] };
    const { source, after } = cast(m, 'redside3');
    assert.equal(find(after, foe.instanceId)?.powerModifier, -1);
    const robbers = after.boards.flat().filter(card => card.cardId === 'redside3'
      && card.instanceId.startsWith('summon:') && card.owner === 'player');
    assert(robbers.length <= 1, 'one reveal can summon at most one Red Robber');
    outcomes.add(robbers.length);
    if (robbers.length) {
      assert.notEqual(robbers[0].lane, 0, 'the summoned Red Robber uses another district');
      assert.equal(find(after, source.instanceId)?.cardId, 'redside3');
      assert.equal(find(after, otherFoes[robbers[0].lane! - 1].instanceId)?.powerModifier, -1,
        'arrival reduces the enemy in the destination district by one Hand');
      sawArrivalReduction = true;
    }
    assert.deepEqual(cast(JSON.parse(JSON.stringify(m)), 'redside3').after, after, 'summon roll replays identically');
  }
  assert.deepEqual([...outcomes].sort(), [0, 1], 'deterministic rolls exercise both sides of the 50% summon');
  assert(sawArrivalReduction);
});

test('Blue Crossfire scales with Blue Side board presence and respects reduction immunity', () => {
  assert.equal(catalogCardById['blue-side-2'].cost, 1);
  assert.equal(catalogCardById['blue-side-2'].power, 2);
  const ally = unit('blueside2', 'player', 0, 170), foe = unit('hooper', 'cpu', 1, 171);
  const m = { ...blank(), boards: [[ally], [foe], []] as Match['boards'] };
  const { source, after } = cast(m, 'blueside1');
  assert.equal(find(after, foe.instanceId)?.powerModifier, -3);
  assert.equal(find(after, source.instanceId)?.powerModifier, 2, 'self counts among Blue Side allies');

  const immune = unit('hooper', 'cpu', 1, 172);
  immune.statuses.uncounterable = true;
  const blocked = cast({ ...blank(), boards: [[], [immune], []] }, 'blueside1');
  assert.equal(find(blocked.after, immune.instanceId)?.powerModifier, 0);
  const ogBlue = unit('blueside1', 'cpu', 0, 173);
  ogBlue.powerModifier = 2;
  const attemptedReduction = cast({ ...blank(), boards: [[ogBlue], [], []] }, 'redside2');
  assert.equal(find(attemptedReduction.after, ogBlue.instanceId)?.powerModifier, 2,
    'OG Blue cannot lose either printed or bonus Hands');
});

test('Blue supports protect the next ally, recur movement, cleanse, and reward a successful Weaken', () => {
  const { source: bulwark, after: protectedMatch } = cast(blank(), 'blueside2');
  assert.equal(find(protectedMatch, bulwark.instanceId)?.powerModifier, 1);
  const nextAlly = cast(protectedMatch, 'cornball');
  assert.equal(find(nextAlly.after, nextAlly.source.instanceId)?.statuses.protected, true);

  const weakAlly = unit('cornball', 'player', 0, 180), affected = unit('cornball', 'player', 0, 181);
  affected.statuses.frozen = true;
  const loco = cast({ ...blank(), boards: [[weakAlly, affected], [], []] }, 'blueside4');
  assert.equal(find(loco.after, affected.instanceId)?.statuses.frozen, false);
  assert.equal(find(loco.after, affected.instanceId)?.powerModifier, 2);
  const fallback = cast(blank(), 'blueside4');
  assert.equal(find(fallback.after, fallback.source.instanceId)?.statuses.protected, true);
  assert.equal(find(fallback.after, fallback.source.instanceId)?.powerModifier, 1);

  const enemy = unit('hooper', 'cpu', 0, 182);
  const trippin = cast({ ...blank(), boards: [[enemy], [], []] }, 'blueside5');
  assert.equal(find(trippin.after, enemy.instanceId)?.statuses.weakened, true);
  assert.equal(find(trippin.after, trippin.source.instanceId)?.powerModifier, 1);

  const weakenedSource = find(trippin.after, trippin.source.instanceId)!;
  weakenedSource.powerModifier = 1 - weakenedSource.basePower;
  const destroyed = cast({ ...trippin.after, phase: 'cpu-reveal' }, 'redside2', 'cpu').after;
  assert.equal(find(destroyed, trippin.source.instanceId), undefined, 'a lethal hit destroys Blue Big Trippin');
  const rewarded = cast(destroyed, 'cornball');
  assert.equal(find(rewarded.after, rewarded.source.instanceId)?.powerModifier, 1,
    'destruction boosts the next friendly deployment');
});

test('Blue Scarf crashout moves allies from every district and replays its later-round trigger', () => {
  const home = unit('cornball', 'player', 0, 183);
  const east = unit('cornball', 'player', 1, 184);
  const west = unit('cornball', 'player', 2, 185);
  const enemies = [0, 1, 2].map(lane => unit('hooper', 'cpu', lane as Lane, 186 + lane));
  const m = { ...blank(), boards: [[home, enemies[0]], [east, enemies[1]], [west, enemies[2]]] as Match['boards'] };
  const { source, after } = cast(m, 'blueside3');
  for (const ally of [home, east, west]) {
    assert.notEqual(find(after, ally.instanceId)?.lane, ally.lane,
      'the reveal moves an ally from each occupied district');
    assert.equal(Math.abs(find(after, ally.instanceId)!.lane! - ally.lane!), 1,
      'each ally moves to an adjacent district, never across both outer districts');
  }
  const allyDeltas = [home, east, west].map(card =>
    (find(after, card.instanceId)?.powerModifier ?? card.powerModifier) - card.powerModifier);
  const enemyDeltas = enemies.map(card =>
    (find(after, card.instanceId)?.powerModifier ?? card.powerModifier) - card.powerModifier);
  assert(
    (allyDeltas.every(delta => delta === 1) && enemyDeltas.every(delta => delta === 0))
      || (allyDeltas.every(delta => delta === 1) && enemyDeltas.every((delta, index) => delta === [0, -2, -1][index])),
    'one 50/50 roll applies the same give-or-steal outcome to all moved allies',
  );
  const outcomes = new Set<string>();
  for (let sequence = 1; sequence <= 32; sequence++) {
    const start = { ...m, nextEventSequence: sequence };
    const resolved = cast(start, 'blueside3').after;
    outcomes.add(enemies.some(card => (find(resolved, card.instanceId)?.powerModifier ?? 0) < 0) ? 'steal' : 'give');
    assert.deepEqual(cast(JSON.parse(JSON.stringify(start)), 'blueside3').after, resolved);
  }
  assert.deepEqual([...outcomes].sort(), ['give', 'steal'], 'both deterministic 50/50 outcomes occur');
  const later = { ...after, phase: 'resolved' as const };
  const advanced = nextRound(later);
  assert.deepEqual(nextRound(JSON.parse(JSON.stringify(later))), advanced,
    'the recurring move and its deterministic give-or-steal roll replay identically');
  assert.equal(advanced.effectLog.filter(event => event.cardId === 'blueside3'
    && event.sequence >= after.nextEventSequence).length, 1, 'Crashout triggers once again in the later round');
  assert(find(advanced, source.instanceId));
});

test('Wicked Witch drains each buffed enemy and summons one Monkey; forced Monkey moves add Burn', () => {
  const first = unit('hooper', 'cpu', 0, 190), second = unit('hooper', 'cpu', 0, 191);
  first.powerModifier = 1; second.powerModifier = 3;
  const { source, after } = cast({ ...blank(), boards: [[first, second], [], []] }, 'wickedwitch');
  assert.equal(find(after, first.instanceId)?.powerModifier, 0);
  assert.equal(find(after, second.instanceId)?.powerModifier, 1);
  assert.equal(find(after, source.instanceId)?.powerModifier, 2);
  assert.equal(after.boards[0].filter(card => card.cardId === 'flyingmonkeys' && card.owner === 'player').length, 1);

  const target = unit('hooper', 'cpu', 0, 192);
  const moved = cast({ ...blank(), boards: [[target], [], []] }, 'flyingmonkeys');
  assert.notEqual(find(moved.after, target.instanceId)?.lane, 0);
  assert.equal(find(moved.after, target.instanceId)?.statuses.burnStacks, 1);
  target.statuses.locked = true;
  const stopped = cast({ ...blank(), boards: [[target], [], []] }, 'flyingmonkeys');
  assert.equal(find(stopped.after, target.instanceId)?.statuses.burnStacks, 0);
});

test('a ten-card crew with both Oz cards verifies its full solo transcript', () => {
  const playerIds = [...ids.slice(0, 8), 'wickedwitch', 'flyingmonkeys'];
  const cpuIds = decks.find(deck => deck.id === 'block')!.cards;
  let match = createMatchFromEngineCards('side-oz', playerIds, 'block', cpuIds);
  const moves: PlayerMove[] = [];
  while (match.phase !== 'complete') {
    const legal = match.playerHand.flatMap(card => ([0, 1, 2] as Lane[])
      .map(lane => ({ card, lane, cost: getLegalCardCost(match, 'player', card, lane) })))
      .find(choice => choice.cost <= match.playerMotion);
    if (legal) {
      moves.push({ cardInstanceId: legal.card.instanceId, lane: legal.lane, squabble: false, endTurn: false });
      match = playTurnCard(match, 'player', legal.card.instanceId, legal.lane, false);
    } else {
      moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
      match = nextRound(revealCpuTurn(pass(match, 'player')));
    }
    assert(moves.length < 65, 'match must finish');
  }
  assert.deepEqual(verifyMatchTranscript('side-oz', 'block', moves, undefined, playerIds), match);
});

test('online rooms expose both sides of a new card play without a private hand', () => {
  const cardIds = [...ids.slice(0, 8), 'wickedwitch', 'flyingmonkeys'];
  const member = (userId: string) => ({ userId, name: userId, ready: false,
    deck: { id: userId, name: 'Side crew', hero: cardIds[0], cards: cardIds } });
  let room = createOnlineRoom(member('red'), 'player', 0);
  room = joinOnlineRoom(room, member('blue'), 1);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, 2);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 3);
  const source = room.match!.playerHand.find(c => c.cardId === 'redside1')!;
  const play = { type: 'play' as const, instanceId: source.instanceId, lane: 0 as Lane, squabble: false };
  const replay = applyOnlineCommand(room, 'player', play, 4);
  room = applyOnlineCommand(room, 'player', play, 4);
  assert.deepEqual(room.match, replay.match, 'the room command transcript replays to the same resolved match');
  let hostView: ReturnType<typeof onlineRoomView> | undefined;
  let guestView: ReturnType<typeof onlineRoomView> | undefined;
  for (const user of ['red', 'blue']) {
    const view = onlineRoomView(room, 'SIDE', user, 5);
    assert(view.boards.flat().some(c => c.cardId === 'redside1'));
    assert(!JSON.stringify(view).includes('"cpuHand"'));
    if (user === 'red') hostView = view;
    else guestView = view;
  }
  assert.deepEqual(hostView!.boards, guestView!.boards, 'both players observe the same public Side-Oz transcript');
  assert.equal(getEffectiveCardPower(find(room.match!, source.instanceId)!), 3);
});

test('Red Side and Blue Side crews play all ten revised moves across both seats', () => {
  const red: BalanceDeck = { id: 'red-side-test', name: 'Red Side', cardIds: [
    'redside1', 'redside2', 'redside3', 'redside4', 'redside5',
    'cornball', 'plug', 'delivery', 'hooper', 'rastamon',
  ] };
  const blue: BalanceDeck = { id: 'blue-side-test', name: 'Blue Side', cardIds: [
    'blueside1', 'blueside2', 'blueside3', 'blueside4', 'blueside5',
    'cornball', 'bikelife', 'plug', 'vibe', 'tinman',
  ] };
  for (const seat of ['a-player', 'b-player'] as const) {
    const result = simulateBalanceMatch({
      deckA: red, deckB: blue, districtSeed: 'side-oz-test-a', rotation: 0, tier: 0, seat,
    });
    assert(result.plays >= 10);
    for (const [id] of SIDE_OZ_WAVE.filter(([, , , , , , , , , , faction]) =>
      faction === 'Red Side' || faction === 'Blue Side')) {
      const observation = (id.startsWith('red') ? result.cardsA : result.cardsB).find(card => card.cardId === id);
      assert(observation && observation.played > 0 && observation.abilityTriggers > 0,
        `${id} must actually play and use its move with ${seat}`);
    }
    assert(result.cardsB.find(card => card.cardId === 'blueside3')!.abilityTriggers > 1,
      'Blue Scarf crashout continues moving allies after its reveal');
  }
});

test('the ten-card Oz deck plays Witch and Monkeys against Alice and Queen from both seats', () => {
  const focus = createDefaultBalanceDecks();
  const oz = focus.find(deck => deck.id === 'focus-wiz')!;
  const alice = focus.find(deck => deck.id === 'focus-wonderland')!;
  assert(oz && alice);
  assert.deepEqual(oz.cardIds.filter(id => ['wickedwitch', 'flyingmonkeys'].includes(id)),
    ['wickedwitch', 'flyingmonkeys']);
  for (const id of ['dorothy', 'scarecrow', 'tinman', 'lion', 'oz']) assert(oz.cardIds.includes(id));
  for (const id of ['alice', 'cheshire', 'queenofhearts', 'mrrabbit', 'dorothy', 'guap', 'madhatter']) assert(alice.cardIds.includes(id));
  for (const deck of [oz, alice]) {
    assert.equal(deck.cardIds.length, 10);
    const ownedCatalogIds = deck.cardIds.map(id => cards[id].id);
    assert(validateSavedDeck(ownedCatalogIds, ownedCatalogIds, ownedCatalogIds[0]).valid,
      `${deck.name} must be a legal owned ten-card crew`);
  }
  for (const seat of ['a-player', 'b-player'] as const) {
    let aliceReturned = false;
    const input = { deckA: oz, deckB: alice, districtSeed: 'side-oz-test-g',
      rotation: 2, tier: 0 as const, seat,
      observeComplete: (match: Match) => {
        assert.equal(match.phase, 'complete');
        aliceReturned = match.effectLog.some(event => event.note === 'Alice returned to hand.');
      },
    };
    const result = simulateBalanceMatch(input);
    assert.deepEqual(simulateBalanceMatch({ ...input, observeComplete: undefined }), result,
      'Oz versus Alice resolves identically from the same seed and seat');
    for (const id of ['wickedwitch', 'flyingmonkeys']) {
      const observation = result.cardsA.find(card => card.cardId === id);
      assert(observation && observation.played > 0 && observation.abilityTriggers > 0,
        `${id} must fire in the actual Oz deck versus Alice (${seat})`);
    }
    assert(result.cardsB.find(card => card.cardId === 'alice')!.played >= 2,
      'Alice must return and redeploy, not merely sit in the ten-card list');
    const queen = result.cardsB.find(card => card.cardId === 'queenofhearts');
    assert(queen && queen.played > 0 && queen.abilitySuccesses > 0,
      'Queen of Hearts must land her execution in the actual Alice deck against Oz');
    assert(aliceReturned);
  }
});

test('Alice’s entire Wonderland test crew completes an authoritative solo replay', () => {
  const alice = createDefaultBalanceDecks().find(deck => deck.id === 'focus-wonderland')!;
  const opponent = decks.find(deck => deck.id === 'block')!;
  let match = createMatchFromEngineCards(alice.id, [...alice.cardIds], opponent.id, [...opponent.cards]);
  const moves: PlayerMove[] = [];
  while (match.phase !== 'complete') {
    const legal = match.playerHand.flatMap(card => ([0, 1, 2] as Lane[])
      .map(lane => ({ card, lane, cost: getLegalCardCost(match, 'player', card, lane) }))
      .filter(choice => choice.cost <= match.playerMotion))
      .sort((a, b) => Number(b.card.cardId === 'alice') - Number(a.card.cardId === 'alice')
        || a.cost - b.cost || a.lane - b.lane)[0];
    if (legal) {
      moves.push({ cardInstanceId: legal.card.instanceId, lane: legal.lane, squabble: false, endTurn: false });
      match = playTurnCard(match, 'player', legal.card.instanceId, legal.lane, false);
    } else {
      moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
      match = nextRound(revealCpuTurn(pass(match, 'player')));
    }
    assert(moves.length <= 64, 'Alice’s match must complete within the transcript limit');
  }
  assert(match.effectLog.some(event => event.note === 'Alice returned to hand.'));
  assert(match.effectLog.filter(event => event.type === 'play' && event.cardId === 'alice').length >= 2);
  assert.deepEqual(verifyMatchTranscript(alice.id, opponent.id, moves, undefined, alice.cardIds), match);
});