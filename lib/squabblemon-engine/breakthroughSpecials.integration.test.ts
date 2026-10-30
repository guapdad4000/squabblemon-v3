/** Real reducer integration, separate from isolated contract tests. These fixtures
 * deliberately seed board states; they do not claim production PvP/player proof. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advance,
  createGame,
  deploy,
  deploymentCost,
  type GameState,
  type Unit,
  type Side,
  type Lane,
} from './src/breakthrough';
import {
  BREAKTHROUGH_ROSTER,
  resolveBreakthroughCard,
} from './src/breakthroughCatalog';
import { SPECIAL_ARTWORK } from './src/breakthroughSpecials';
let serial = 0;
const deck = [
  'edgar',
  'nguyen',
  'cornball',
  'hooper',
  'plug',
  'chonk-lee',
  'bushedo-brown',
  'guap',
  'kyle',
  'racially-ambiguous-transplant',
];
function unit(
  cardId: string,
  side: Side = 'player',
  lane: Lane = 0,
  hands?: number,
): Unit {
  const d = resolveBreakthroughCard(cardId)!;
  assert.ok(d, cardId);
  return {
    id: `special-core-${++serial}`,
    cardId,
    side,
    lane,
    position: side === 'player' ? 0.15 : 0.85,
    hands: hands ?? d.hands,
    baseHands: d.hands,
    maxHands: hands ?? d.hands,
    squabbled: false,
    nextEffectAt: 1e9,
    origin: 'deck',
  };
}
function game(units: Unit[] = []): GameState {
  const s = createGame(BREAKTHROUGH_ROSTER, {
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
    seed: 74251,
  });
  s.units = units;
  for (const side of ['player', 'opponent'] as const) {
    s.players[side].hand = [];
    s.players[side].queue = [];
    s.players[side].nextDrawAt = 1e9;
  }
  return s;
}
function play(
  s: GameState,
  id: string,
  lane: Lane = 0,
  side: Side = 'player',
  preserveHand = false,
): GameState {
  const p = s.players[side];
  p.motion = 9;
  if (!preserveHand) p.hand = [id];
  else p.hand = [...p.hand.filter((c) => c !== id), id];
  const result = deploy(s, side, id, lane);
  assert.equal(result.error, undefined, `${id}: ${result.error}`);
  assert.equal(
    result.state.elapsedMs,
    s.elapsedMs,
    'No animation/input clock wait',
  );
  return result.state;
}
const find = (s: GameState, u: Unit) => s.units.find((v) => v.id === u.id);

test('Scammer copies a real Stockz ongoing kit without its entrance or membership and growth fires on later character play', () => {
  const target = unit('stockz', 'opponent', 0, 12);
  let s = play(game([target]), 'scammer');
  let actor = s.units.find((u) => u.cardId === 'scammer')!;
  assert.equal(actor.baseHands, 4);
  assert.equal(actor.hands, 4);
  assert.equal(actor.copiedAbility, 'compound-interest');
  assert.deepEqual(actor.copiedTriggers, ['ongoing']);
  assert.equal(actor.cardId, 'scammer');
  assert.equal(resolveBreakthroughCard(actor.cardId)?.element, 'Dark');
  const id = actor.id;
  s = play(s, 'edgar', 1);
  actor = s.units.find((u) => u.id === id)!;
  assert.equal(actor.hands, 5);
  assert.equal(find(s, target)?.hands, 12);
  assert.equal(s.metrics.player.deployments, 2);
});
test('Tayaty repeats a genuinely failed Nguyen entrance from a new lane and restores its own kit', () => {
  let s = play(game(), 'nguyen', 0);
  const nguyen = s.units.find((u) => u.cardId === 'nguyen')!;
  assert.equal(nguyen.entranceSucceeded, false);
  s = play(s, 'bad-lil-cousin-tayaty', 1);
  const tayaty = s.units.find((u) => u.cardId === 'bad-lil-cousin-tayaty')!;
  assert.equal(tayaty.hands, 5);
  assert.equal(tayaty.copiedAbility, undefined);
  assert.equal(find(s, nguyen)?.hands, 2);
  assert.equal(s.metrics.player.deployments, 2);
});
test('Coach observes actual failed entrance then later paid placement retries only that trainee until success', () => {
  let s = play(game(), 'nguyen');
  const nguyen = s.units.find((u) => u.cardId === 'nguyen')!;
  s = play(s, 'corner-coach');
  assert.equal(s.specials?.coaches.length, 1);
  assert.equal(find(s, nguyen)?.hands, 2);
  s = play(s, 'edgar', 1);
  assert.equal(find(s, nguyen)?.hands, 3);
  assert.equal(find(s, nguyen)?.entranceSucceeded, true);
  assert.equal(s.specials?.coaches.length, 0);
  assert.equal(s.metrics.player.deployments, 3);
  s = play(s, 'edgar', 2);
  assert.equal(find(s, nguyen)?.hands, 3);
});
test('Jigga summons real ordinary tokens and hits the strongest two across remote lanes through the real hostile path', () => {
  const a = unit('edgar', 'opponent', 1, 8),
    b = unit('nguyen', 'opponent', 2, 7),
    local = unit('hooper', 'opponent', 0, 3);
  let s = play(game([a, b, local]), 'captain-jigga');
  assert.equal(find(s, a)?.hands, 6);
  assert.equal(find(s, b)?.hands, 5);
  assert.equal(find(s, local)?.hands, 3);
  const stewards = s.units.filter((u) => u.cardId === 'steward');
  assert.equal(stewards.length, 2);
  assert.ok(stewards.every((u) => u.origin === 'summon' && u.position === 0));
  assert.equal(s.metrics.player.deployments, 1);
  assert.ok(
    s.events
      .filter(
        (e) =>
          e.type === 'damage' &&
          e.targetUnitId &&
          [a.id, b.id].includes(e.targetUnitId),
      )
      .every((e) => stewards.some((u) => u.id === e.sourceUnitId)),
  );
});
test('Guyana ignores targeted Weaken but is removed by physical combat without deck recycling', () => {
  let s = play(game(), 'ashlee');
  const guyana = s.units.find((u) => u.cardId === 'guyana')!;
  assert.equal(guyana.immune, true);
  assert.equal(guyana.immunityScope, 'abilities');
  s.units = s.units.filter((u) => u.id === guyana.id);
  s = play(s, 'red-side-4', guyana.lane, 'opponent');
  assert.equal(!!find(s, guyana)?.weakened, false);
  s.units = s.units.filter((u) => u.id === guyana.id);
  const enemy = unit('nguyen', 'opponent', guyana.lane, 8);
  const gorilla = find(s, guyana)!;
  gorilla.position = 0.4;
  enemy.position = 0.62;
  s.units.push(enemy);
  s = advance(s, 50);
  assert.equal(find(s, guyana), undefined);
  assert.equal(
    s.players.player.returns.some((r) => r.cardId === 'guyana'),
    false,
  );
  assert.equal(s.players.player.queue.includes('guyana'), false);
});
test('LeBron real personal shield retaliation hits attacker once and cannot be cashed by later ordinary combat', () => {
  const ally = unit('hooper', 'player', 0, 10);
  let s = play(game([ally]), 'lebron-james');
  assert.equal(find(s, ally)?.protected, true);
  s = play(s, 'ganger-red', 0, 'opponent');
  assert.equal(find(s, ally)?.hands, 10);
  assert.equal(find(s, ally)?.protected, false);
  assert.equal(
    s.units.some((u) => u.cardId === 'ganger-red'),
    false,
  );
  assert.equal(s.specials?.seats.player.used['revenge:lebron-james'], true);
  assert.equal(
    s.players.opponent.returns.filter((r) => r.cardId === 'ganger-red').length,
    1,
  );
});
test('Oz uses real historical successful traveler and gives only2 without a current-pulse lane move', () => {
  let s = play(game(), 'lion');
  const lion = s.units.find((u) => u.cardId === 'lion')!;
  assert.equal(lion.protected, true);
  assert.equal(lion.entranceSucceeded, true);
  s = advance(s, 10000);
  s = play(s, 'edgar', 2);
  s = play(s, 'oz', 1);
  assert.equal(find(s, lion)?.hands, 5);
  assert.equal(s.specials?.seats.player.used['oz:oz'], true);
  assert.equal(s.metrics.player.deployments, 3);
});
test('Actual hand return keeps Unit identity/current Hands; held Rabbit/Cheshire leave one Grin and a minimum1 quote', () => {
  const ally = unit('edgar', 'player', 0, 4);
  let s = game([ally]);
  s.players.player.hand = ['cheshire', 'mr-rabbit'];
  s = play(s, 'dorothy', 0, 'player', true);
  assert.ok(s.players.player.hand.includes('edgar'));
  assert.equal(s.players.player.returnedHands?.edgar, 5);
  assert.equal(s.players.player.returnedUnits?.edgar.id, ally.id);
  assert.equal(s.units.filter((u) => u.cardId === 'grin').length, 1);
  assert.equal(deploymentCost(s, 'player', 'edgar', 0), 1);
  s = play(s, 'edgar', 0, 'player', true);
  assert.equal(find(s, ally)?.hands, 7); // carried5 + Edgar's real cheap Dorothy neighbor+2
  assert.equal(find(s, ally)?.id, ally.id);
  assert.equal(s.players.player.returnedUnits?.edgar, undefined);
  assert.equal(s.players.player.returnedHands?.edgar, undefined);
});
test('Mary delayed Elephant preserves signed invested/damaged Hands, cost/art and id through a later live hand return', () => {
  let s = play(game(), 'ms-mary-mack');
  const initial = s.units.find((u) => u.cardId === 'ms-mary-mack')!;
  initial.hands = 5;
  initial.maxHands = 8;
  for (let i = 0; i < 5; i++) s.units.push(unit('edgar', 'opponent', 0, 5));
  s = advance(s, 10000);
  assert.equal(find(s, initial), undefined);
  assert.equal(s.players.player.returns.length, 0);
  s = advance(s, 10000);
  let elephant = find(s, initial)!;
  assert.equal(elephant.baseHands, 4);
  assert.equal(elephant.hands, 6);
  assert.equal(elephant.art, SPECIAL_ARTWORK.elephant);
  assert.equal(elephant.formCost, 4);
  assert.equal(elephant.position < 0.001, true);
  const lane = elephant.lane;
  s = play(s, 'mad-hatter', lane);
  assert.ok(s.players.player.hand.includes('ms-mary-mack'));
  assert.equal(s.players.player.returnedHands?.['ms-mary-mack'], 7);
  assert.equal(deploymentCost(s, 'player', 'ms-mary-mack', 2), 3);
  s = play(s, 'ms-mary-mack', 2);
  elephant = find(s, initial)!;
  assert.equal(elephant.hands, 7);
  assert.equal(elephant.baseHands, 4);
  assert.equal(elephant.formCost, 4);
  assert.equal(elephant.art, SPECIAL_ARTWORK.elephant);
  assert.equal(s.specials?.mary[initial.id].used, true);
});
test('Mary final-stand census keeps her on mat and JSON checkpoint preserves the exact pending form resolution', () => {
  let s = play(game(), 'ms-mary-mack');
  const mary = s.units.find((u) => u.cardId === 'ms-mary-mack')!;
  for (let i = 0; i < 5; i++) s.units.push(unit('edgar', 'opponent', 0, 5));
  s = advance(s, 10000);
  const checkpoint = JSON.parse(JSON.stringify(s)) as GameState;
  assert.deepEqual(advance(checkpoint, 10000), advance(s, 10000));
  let late = play(game(), 'ms-mary-mack');
  const last = late.units.find((u) => u.cardId === 'ms-mary-mack')!;
  for (let i = 0; i < 5; i++) late.units.push(unit('edgar', 'opponent', 0, 5));
  late.elapsedMs = 150000;
  late.drawsLocked = true;
  late = advance(late, 10000);
  assert.ok(find(late, last));
  assert.equal(late.specials?.mary[last.id].pending, undefined);
  assert.equal(late.specials?.mary[last.id].cents, 15);
  assert.equal(late.specials?.mary[last.id].used, false);
});
test('Swookie real recruit preserves private deck ownership, uses Snow Freeze and returns KO to original owner only', () => {
  const snow = unit('snow-bunny', 'opponent', 1, 4),
    victim = unit('edgar', 'opponent', 1, 8);
  victim.position = 0.4;
  let s = play(game([snow, victim]), 'pimp-swookie');
  const decks = structuredClone(s.decks);
  s = advance(s, 50);
  assert.equal(find(s, snow)?.side, 'player');
  assert.equal(find(s, snow)?.originalOwner, 'opponent');
  assert.equal(find(s, victim)?.frozen, true);
  assert.deepEqual(s.decks, decks);
  s.units = s.units.filter((u) => u.id !== victim.id);
  find(s, snow)!.hands = 1;
  s = play(s, 'ganger-red', 1, 'opponent');
  assert.equal(find(s, snow), undefined);
  assert.equal(
    s.players.opponent.returns.filter((r) => r.cardId === 'snow-bunny').length,
    1,
  );
  assert.equal(
    s.players.player.returns.filter((r) => r.cardId === 'snow-bunny').length,
    0,
  );
  assert.deepEqual(s.decks, decks);
});
test('Borrowed Snow live-return uses original owner observers and carries discount to recipient without replacing either deck', () => {
  const snow = unit('snow-bunny', 'opponent', 0, 2);
  let s = play(game([snow]), 'pimp-swookie');
  s = advance(s, 50);
  assert.equal(find(s, snow)?.side, 'player');
  s.players.opponent.hand = ['cheshire', 'mr-rabbit'];
  const decks = structuredClone(s.decks);
  s = play(s, 'mad-hatter', 0);
  assert.ok(s.players.opponent.hand.includes('snow-bunny'));
  assert.equal(s.players.player.hand.includes('snow-bunny'), false);
  assert.equal(s.players.opponent.returnedUnits?.['snow-bunny'].id, snow.id);
  assert.equal(
    s.players.opponent.returnedUnits?.['snow-bunny'].side,
    'opponent',
  );
  assert.equal(deploymentCost(s, 'opponent', 'snow-bunny', 1), 2);
  assert.ok(s.units.some((u) => u.cardId === 'grin' && u.side === 'opponent'));
  assert.equal(
    s.units.some((u) => u.cardId === 'grin' && u.side === 'player'),
    false,
  );
  assert.deepEqual(s.decks, decks);
});
test('Token catalog templates cannot be submitted as collectible decks or manually deployed from a tampered hand', () => {
  assert.throws(() =>
    createGame(BREAKTHROUGH_ROSTER, {
      decks: { player: ['guyana', ...deck.slice(1)], opponent: deck },
    }),
  );
  let s = play(game(), 'ashlee');
  s.players.player.hand = ['guyana'];
  const before = structuredClone(s);
  const rejected = deploy(s, 'player', 'guyana', 0);
  assert.ok(rejected.error);
  assert.equal(rejected.state, s);
  assert.deepEqual(s, before);
});
test('Mary suspends Burn while absent, drops expired statuses and resumes a live Burn without retroactive ticks', () => {
  let s = play(game(), 'ms-mary-mack');
  const mary = s.units.find((u) => u.cardId === 'ms-mary-mack')!;
  mary.hands = 5;
  mary.maxHands = 8;
  for (let i = 0; i < 5; i++) s.units.push(unit('edgar', 'opponent', 0, 5));
  s.elapsedMs = 9500;
  for (const expiresAt of [15000, 25000])
    s.statuses.push({
      id: s.nextEffectId++,
      kind: 'burn',
      targetId: mary.id,
      sourceUnitId: 'old-fire',
      sourceSide: 'opponent',
      sourceLane: 0,
      sourcePosition: 0.9,
      appliedAt: 9000,
      nextTickAt: 11000,
      expiresAt,
      stacks: 1,
    });
  s = advance(s, 500);
  assert.equal(find(s, mary), undefined);
  assert.equal(
    s.statuses.some((x) => x.targetId === mary.id),
    false,
  );
  assert.equal(
    s.specials?.mary[mary.id].pending?.snapshot.suspendedStatuses?.length,
    2,
  );
  s = advance(s, 10000);
  assert.equal(find(s, mary)?.hands, 6);
  const resumed = s.statuses.filter((x) => x.targetId === mary.id);
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].expiresAt, 25000);
  assert.equal(resumed[0].nextTickAt, 22000);
  s = advance(s, 2000);
  assert.equal(find(s, mary)?.hands, 5);
});
test('Immutable OG Blue still takes no physical Hands loss while an ability-only immune Guyana can fall', () => {
  const blue = unit('blue-side-1', 'player', 0, 4),
    enemy = unit('nguyen', 'opponent', 0, 8);
  blue.position = 0.4;
  enemy.position = 0.62;
  let s = advance(game([blue, enemy]), 50);
  assert.equal(find(s, blue)?.hands, 4);
  assert.equal(find(s, enemy)?.hands, 4);
  assert.equal(s.metrics.opponent.damage, 0);
  assert.equal(s.metrics.player.damage, 4);
});
test('A genuinely returned Scammer clears copied ongoing kit and runs its own Imposter again on next play', () => {
  const stock = unit('stockz', 'opponent', 0, 12);
  let s = play(game([stock]), 'scammer');
  const scammer = s.units.find((u) => u.cardId === 'scammer')!;
  assert.equal(scammer.copiedAbility, 'compound-interest');
  s = play(s, 'mad-hatter');
  const returned = s.players.player.returnedUnits?.scammer!;
  assert.equal(returned.id, scammer.id);
  assert.equal(returned.copiedAbility, undefined);
  assert.equal(returned.copiedTriggers, undefined);
  const carried = s.players.player.returnedHands?.scammer!;
  s.units = s.units.filter((u) => u.id !== stock.id);
  const enemy = unit('hooper', 'opponent', 0, 9);
  s.units.push(enemy);
  s = play(s, 'scammer');
  const again = find(s, scammer)!;
  assert.equal(again.copiedAbility, undefined);
  assert.equal(again.baseHands, Math.min(7, enemy.baseHands));
  assert.equal(
    again.hands,
    Math.min(7, enemy.baseHands) +
      (carried - resolveBreakthroughCard('scammer')!.hands) +
      1,
  );
  assert.ok(
    s.events.some(
      (e) =>
        e.type === 'copy' &&
        e.targetUnitId === scammer.id &&
        e.text === 'HANDS COPIED',
    ),
  );
});
