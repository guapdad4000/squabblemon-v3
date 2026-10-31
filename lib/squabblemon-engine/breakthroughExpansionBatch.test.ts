import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  advance,
  createGame,
  deploy,
  legalActionTarget,
  type GameState,
  type Unit,
  type Lane,
  type Side,
} from './src/breakthrough';
import {
  BREAKTHROUGH_ROSTER,
  BREAKTHROUGH_STARTER_DECKS,
  resolveBreakthroughCard,
} from './src/breakthroughCatalog';
import { SUPPORT_ADAPTERS } from './src/breakthroughSupports';
let serial = 0;
function unit(
  cardId: string,
  side: Side = 'player',
  lane: Lane = 0,
  hands?: number,
): Unit {
  const card = resolveBreakthroughCard(cardId)!;
  return {
    id: `integrated-${++serial}`,
    cardId,
    side,
    lane,
    position: side === 'player' ? 0.2 : 0.8,
    hands: hands ?? card.hands,
    baseHands: card.hands,
    maxHands: hands ?? card.hands,
    squabbled: false,
    nextEffectAt: 1e9,
  };
}
function game(units: Unit[] = []): GameState {
  const deck = BREAKTHROUGH_STARTER_DECKS[0].catalogCardIds;
  const s = createGame(BREAKTHROUGH_ROSTER, {
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
  s.units = units;
  for (const side of ['player', 'opponent'] as const) {
    s.players[side].hand = [];
    s.players[side].queue = [];
    s.players[side].nextDrawAt = 1e9;
  }
  return s;
}
function play(s: GameState, id: string, lane: Lane = 0, side: Side = 'player') {
  s.players[side].hand = [id];
  s.players[side].motion = 9;
  const result = deploy(s, side, id, lane);
  assert.equal(result.error, undefined, `${id}: ${result.error}`);
  return result.state;
}
const find = (s: GameState, u: Unit) => s.units.find((x) => x.id === u.id)!;
test('all ten new supports pass real deploy validation and resolve as actions without marching, breaches or Squabble', () => {
  for (const id of Object.keys(SUPPORT_ADAPTERS)) {
    const ally = unit('plug'),
      other = unit('cornball'),
      enemy = unit('hooper', 'opponent');
    let s = game([ally, other, enemy]);
    const before = s.units.length;
    assert.equal(legalActionTarget(s, 'player', id, 0).valid, true, id);
    s = play(s, id);
    assert.ok(s.units.length <= before, id);
    assert.ok(!s.units.some((x) => x.cardId === id), id);
    assert.equal(s.players.player.breaches, 0, id);
    assert.equal(s.players.player.squabbleUsed, false, id);
    assert.equal(
      s.players.player.returns.filter((x) => x.cardId === id).length,
      1,
      id,
    );
    assert.equal(s.metrics.player.deployments, 0, id);
  }
});
test('Watch payouts require its own actual personal shield, not a blocked side-eye or ordinary combat', () => {
  const ally = unit('cornball', 'player', 0, 4);
  let s = play(game([ally]), 'bust-down-watch');
  assert.equal(find(s, ally).hands, 5);
  assert.equal(find(s, ally).protected, true);
  s = play(s, 'all-jokes-roaster', 0, 'opponent');
  assert.equal(find(s, ally).hands, 7);
  assert.equal(find(s, ally).protected, false);
  assert.equal(s.statuses.length, 0);
  assert.equal(s.supportRuntime!.watches.length, 0);
  s = play(s, 'all-jokes-roaster', 0, 'opponent');
  assert.equal(find(s, ally).hands, 6);
  assert.equal(s.supportRuntime!.watches.length, 0);
});
test('First Aid prevents contact damage before lethal while simultaneous enemy damage remains exact', () => {
  const ally = unit('cornball', 'player', 0, 2),
    enemy = unit('hooper', 'opponent', 0, 3);
  ally.position = 0.4;
  enemy.position = 0.62;
  let s = play(game([ally, enemy]), 'first-aid-kit');
  const before = structuredClone(s);
  s = advance(s, 50);
  assert.equal(find(s, ally).hands, 1);
  assert.equal(find(s, enemy).hands, 1);
  assert.equal(s.supportRuntime!.kits.length, 0);
  assert.equal(s.metrics.opponent.damage, 1);
  assert.equal(s.metrics.player.damage, 2);
  assert.deepEqual(before.supportRuntime!.kits.length, 1);
});
test('First Aid blocks a burn packet after defenses and is consumed once; cleansing never rearms it', () => {
  const ally = unit('hooper', 'player', 0, 7);
  let s = play(game([ally]), 'first-aid-kit');
  s = play(s, 'cornball', 0, 'opponent');
  const h = find(s, ally).hands;
  s = advance(s, 2000);
  assert.equal(find(s, ally).hands, h);
  assert.equal(s.supportRuntime!.kits.length, 0);
  s = advance(s, 2000);
  assert.equal(find(s, ally).hands, h - 1);
});
test('Encore and fitted boots react to existing lane-movement abilities immediately and once, not to marching', () => {
  const ally = unit('cornball', 'player', 0, 2);
  let s = play(game([ally]), 'black-air-fade-1s');
  assert.equal(find(s, ally).hands, 3);
  s = play(s, 'boombox', 1);
  s = play(s, 'cool-vibe-yn', 1);
  assert.equal(find(s, ally).lane, 1);
  assert.equal(find(s, ally).hands, 6); // fitting1 + Encore1 + Cool Vibe1
  assert.equal(s.supportRuntime!.fittings.length, 0);
  assert.equal(s.supportRuntime!.encores.length, 0);
  const h = find(s, ally).hands;
  s = advance(s, 50);
  assert.equal(find(s, ally).hands, h);
  s.players.player.hand = ['black-air-fade-1s'];
  assert.equal(deploy(s, 'player', 'black-air-fade-1s', 1).error, undefined); // next unfitted local character
  s.units = s.units.filter((x) => x.id === ally.id);
  const original = structuredClone(s);
  const rejected = deploy(s, 'player', 'black-air-fade-1s', 1);
  assert.ok(rejected.error);
  assert.equal(rejected.state, s);
  assert.deepEqual(s, original);
});
test('territory is consumed before a paid character entrance, while same-lane rapid inputs remain synchronous', () => {
  const red = unit('cornball');
  red.gangColor = 'red';
  let s = play(game([red]), 'initiation');
  s.players.player.hand = ['nguyen', 'edgar'];
  s.players.player.motion = 9;
  const first = deploy(s, 'player', 'nguyen', 0);
  assert.equal(first.error, undefined);
  const second = deploy(first.state, 'player', 'edgar', 0);
  assert.equal(second.error, undefined);
  const nguyen = second.state.units.find((x) => x.cardId === 'nguyen')!;
  assert.equal(nguyen.gangColor, 'red');
  assert.equal(nguyen.hands, resolveBreakthroughCard('nguyen')!.hands + 2);
  assert.equal(second.state.supportRuntime!.territory.length, 0);
  assert.equal(second.state.elapsedMs, s.elapsedMs);
  assert.equal(second.state.players.player.reinforcements.length, 0);
});
test('invalid or stale action targets preserve card, Motion, counters and original state atomically', () => {
  const ally = unit('cornball');
  const s = game([ally]);
  s.players.player.hand = ['bust-down-watch'];
  const before = structuredClone(s);
  const rejected = deploy(s, 'player', 'bust-down-watch', 0, false, {
    unitId: 'stale',
  });
  assert.ok(rejected.error);
  assert.equal(rejected.state, s);
  assert.deepEqual(s, before);
  const valid = deploy(s, 'player', 'bust-down-watch', 0, false, {
    unitId: ally.id,
  });
  assert.equal(valid.error, undefined);
  assert.deepEqual(s, before);
});
