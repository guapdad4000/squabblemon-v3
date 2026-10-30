import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advance,
  createGame,
  deploy,
  replayCommand,
  unitDefinition,
  type Unit,
} from './src/breakthrough';
import { BREAKTHROUGH_ROSTER } from './src/breakthroughCatalog';
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
function game() {
  return createGame(structuredClone(BREAKTHROUGH_ROSTER), {
    seed: 8831,
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
}
function unit(cardId = 'hooper'): Unit {
  return {
    id: 'lookup-fixture',
    cardId,
    side: 'player',
    lane: 0,
    position: 0.1,
    hands: 7,
    baseHands: 7,
    maxHands: 7,
    squabbled: false,
    nextEffectAt: 1e9,
  };
}
test('runtime definition observes same-ID object replacement and later in-place printed changes', () => {
  const s = game(),
    u = unit();
  const initial = unitDefinition(s, u),
    index = s.roster.findIndex((c) => c.id === u.cardId);
  s.roster[index] = { ...initial, cost: 8, name: 'LIVE REPLACEMENT' };
  assert.equal(unitDefinition(s, u).cost, 8);
  assert.equal(unitDefinition(s, u).name, 'LIVE REPLACEMENT');
  s.roster[index].cost = 2;
  assert.equal(unitDefinition(s, u).cost, 2);
});
test('runtime definition follows in-place roster swaps and reversals without stale identity', () => {
  const s = game(),
    u = unit(),
    expected = structuredClone(unitDefinition(s, u));
  const index = s.roster.findIndex((c) => c.id === u.cardId);
  [s.roster[index], s.roster[0]] = [s.roster[0], s.roster[index]];
  assert.deepEqual(unitDefinition(s, u), expected);
  s.roster.reverse();
  assert.deepEqual(unitDefinition(s, u), expected);
});
test('roster misses, same-length ID replacement, append and removal cannot reuse an old definition', () => {
  const s = game(),
    u = unit(),
    old = unitDefinition(s, u),
    index = s.roster.findIndex((c) => c.id === u.cardId);
  s.roster[index] = { ...old, id: 'new-catalog-fixture', name: 'NEW ID' };
  assert.equal(unitDefinition(s, u).id, undefined);
  assert.equal(
    unitDefinition(s, { ...u, cardId: 'new-catalog-fixture' }).name,
    'NEW ID',
  );
  s.roster.push({ ...old, name: 'APPENDED' });
  assert.equal(unitDefinition(s, u).name, 'APPENDED');
  s.roster.splice(
    s.roster.findIndex((c) => c.id === u.cardId),
    1,
  );
  assert.equal(unitDefinition(s, u).id, undefined);
});
test('copied kit and permanent form overlays are isolated from canonical cards and other instances', () => {
  const s = game(),
    u = unit('scammer'),
    printed = structuredClone(unitDefinition(s, u)),
    other = { ...u, id: 'other-instance' };
  u.copiedAbility = 'compound-interest';
  u.copiedTriggers = ['ongoing'];
  u.formBaseHands = 4;
  u.formCost = 4;
  u.art = '/approved-elephant.webp';
  const view = unitDefinition(s, u);
  assert.equal(view.id, 'scammer');
  assert.equal(view.element, printed.element);
  assert.equal(view.ability, 'compound-interest');
  assert.equal(view.hands, 4);
  assert.equal(view.cost, 4);
  assert.equal(view.art, '/approved-elephant.webp');
  assert.deepEqual(unitDefinition(s, other), printed);
  assert.deepEqual(
    s.roster.find((c) => c.id === 'scammer'),
    printed,
  );
  view.triggers = ['entrance'];
  assert.deepEqual(unitDefinition(s, u).triggers, ['ongoing']);
  delete u.copiedAbility;
  delete u.copiedTriggers;
  delete u.formBaseHands;
  delete u.formCost;
  delete u.art;
  assert.deepEqual(unitDefinition(s, u), printed);
});
test('cached lookups preserve pure command replay and serialized continuation', () => {
  let s = game();
  for (const side of ['player', 'opponent'] as const) {
    s.players[side].hand = ['plug'];
    s.players[side].motion = 9;
  }
  for (let i = 0; i < 300; i++) unitDefinition(s, unit());
  const before = structuredClone(s),
    result = deploy(s, 'player', 'plug', 0);
  assert.equal(result.error, undefined);
  assert.deepEqual(s, before);
  assert.deepEqual(replayCommand(s, result.state.commands.at(-1)!), result);
  const restored = JSON.parse(JSON.stringify(result.state));
  assert.deepEqual(advance(restored, 10100), advance(result.state, 10100));
});
