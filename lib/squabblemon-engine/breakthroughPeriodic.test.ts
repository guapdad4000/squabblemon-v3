import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  advance,
  createGame,
  type FighterDefinition,
  type GameState,
  type Side,
  type Unit,
} from './src/breakthrough';

const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
  id: `periodic-${i}`,
  name: `Periodic ${i}`,
  cost: 2,
  hands: 4,
  art: '',
  description: 'Periodic ability regression',
  ability: i < 2 ? 'burn' : 'none',
}));
function fighter(
  id: string,
  side: Side,
  position: number,
  hands = 4,
  burn = false,
): Unit {
  return {
    id,
    side,
    position,
    hands,
    cardId: burn ? 'periodic-0' : 'periodic-2',
    lane: 0,
    baseHands: hands,
    maxHands: hands,
    squabbled: false,
    nextEffectAt: burn ? 50 : 999999,
  };
}
function setup(
  target: Unit,
  sources = [fighter('emitter-a', 'player', 0.2, 4, true)],
): GameState {
  const state = createGame(roster, { travelMs: 1000000 });
  state.units = [...sources, target];
  return state;
}

test('periodic burn consumes Protection without damage and preserves immunity', () => {
  for (const defense of ['protected', 'immune'] as const) {
    const target = { ...fighter('target', 'opponent', 0.8), [defense]: true };
    const state = advance(setup(target), 50),
      survivor = state.units.find((u) => u.id === target.id)!;
    assert.equal(survivor.hands, 4);
    assert.equal(survivor[defense], defense === 'immune');
    assert.equal(state.metrics.player.damage, 0);
    assert.equal(state.events.filter((e) => e.type === 'burn').length, 0);
    const blocked = state.events.find((e) => e.type === 'block')!;
    assert.equal(blocked.sourceUnitId, 'emitter-a');
    assert.equal(blocked.sourceSide, 'player');
    assert.equal(blocked.sourcePosition, 0.2);
    const second = advance(state, 5000);
    assert.equal(
      second.units.find((u) => u.id === target.id)!.hands,
      defense === 'immune' ? 4 : 3,
    );
  }
});

test('periodic burn uses packed lunch once and attributes actual damage and healing separately', () => {
  const target = fighter('target', 'opponent', 0.8);
  target.lunch = {
    sourceUnitId: 'packed-by-abuela',
    sourceSide: 'opponent',
    sourceLane: 1,
    sourcePosition: 0.9,
  };
  const state = advance(setup(target), 50),
    survivor = state.units.find((u) => u.id === target.id)!;
  assert.equal(survivor.hands, 4);
  assert.equal(survivor.damageTaken, 0);
  assert.equal(survivor.lunch, undefined);
  assert.equal(state.metrics.player.damage, 1);
  assert.equal(state.metrics.opponent.healing, 1);
  const hit = state.events.find((e) => e.type === 'burn')!;
  assert.equal(hit.targetUnitId, target.id);
  assert.equal(hit.cardId, target.cardId);
  assert.equal(hit.damageKind, 'burn');
  assert.equal(hit.sourceUnitId, 'emitter-a');
  assert.equal(hit.sourcePosition, 0.2);
  assert.equal(hit.position, 0.8);
  assert.equal(
    state.events.find((e) => e.type === 'mend')!.sourceUnitId,
    'packed-by-abuela',
  );
  assert.equal(
    advance(state, 5000).units.find((u) => u.id === target.id)!.hands,
    3,
  );
});

test('multiple periodic burns cannot overcredit a one-Hands target or defeat it twice', () => {
  const target = fighter('target', 'opponent', 0.8, 1);
  const sources = [
    fighter('emitter-b', 'player', 0.1, 4, true),
    fighter('emitter-a', 'player', 0.3, 4, true),
  ];
  const state = advance(setup(target, sources), 50);
  assert.ok(!state.units.some((u) => u.id === target.id));
  assert.equal(state.metrics.player.damage, 1);
  assert.equal(state.events.filter((e) => e.type === 'burn').length, 1);
  assert.equal(
    state.events.find((e) => e.type === 'burn')!.sourceUnitId,
    'emitter-a',
  );
  assert.equal(
    state.events.filter(
      (e) => e.type === 'defeat' && e.targetUnitId === target.id,
    ).length,
    1,
  );
  assert.equal(state.players.opponent.returns.length, 1);
});

test('two periodic emitters independently resolve one Protection charge in stable source order', () => {
  const target = { ...fighter('target', 'opponent', 0.8), protected: true };
  const sources = [
    fighter('emitter-b', 'player', 0.1, 4, true),
    fighter('emitter-a', 'player', 0.3, 4, true),
  ];
  const state = advance(setup(target, sources), 50);
  assert.equal(state.units.find((u) => u.id === target.id)!.hands, 3);
  assert.equal(state.metrics.player.damage, 1);
  assert.equal(
    state.events.find((e) => e.type === 'block')!.sourceUnitId,
    'emitter-a',
  );
  assert.equal(
    state.events.find((e) => e.type === 'burn')!.sourceUnitId,
    'emitter-b',
  );
  assert.deepEqual(
    state.events,
    advance(setup(target, [...sources].reverse()), 50).events,
  );
});

test('reciprocal lethal periodic burns remain simultaneous even if the first hit defeats its source', () => {
  const one = fighter('emitter-a', 'player', 0.2, 1, true),
    two = fighter('emitter-b', 'opponent', 0.8, 1, true);
  const state = advance(setup(two, [one]), 50);
  assert.equal(state.units.length, 0);
  assert.equal(state.metrics.player.damage, 1);
  assert.equal(state.metrics.opponent.damage, 1);
  assert.equal(state.events.filter((e) => e.type === 'burn').length, 2);
  assert.equal(state.events.filter((e) => e.type === 'defeat').length, 2);
  const reversed = advance(setup(one, [two]), 50);
  assert.equal(reversed.units.length, 0);
  assert.deepEqual(state.metrics, reversed.metrics);
  assert.deepEqual(
    state.events.filter((e) => e.type === 'burn'),
    reversed.events.filter((e) => e.type === 'burn'),
  );
});

test('Freeze and Silence stop only their periodic emitter while another friendly emitter still fires', () => {
  for (const side of ['player', 'opponent'] as const)
    for (const kind of ['freeze', 'silence'] as const) {
      const enemy = side === 'player' ? 'opponent' : 'player';
      const at = (position: number) =>
        side === 'player' ? position : 1 - position;
      const muted = fighter('muted', side, at(0.1), 4, true),
        active = fighter('active', side, at(0.3), 4, true);
      const target = fighter('target', enemy, at(0.8));
      const state = setup(target, [muted, active]);
      state.statuses.push({
        id: state.nextEffectId++,
        kind,
        targetId: muted.id,
        sourceUnitId: 'status-source',
        sourceSide: enemy,
        sourceLane: 0,
        sourcePosition: at(0.9),
        appliedAt: 0,
        nextTickAt: 2000,
        expiresAt: 10000,
        stacks: 1,
      });
      const result = advance(state, 50);
      assert.equal(result.units.find((u) => u.id === target.id)!.hands, 3);
      assert.equal(result.events.filter((e) => e.type === 'burn').length, 1);
      assert.equal(
        result.events.find((e) => e.type === 'burn')!.sourceUnitId,
        active.id,
      );
      assert.equal(result.metrics[side].damage, 1);
    }
});
