/** Breadth smoke coverage, not a substitute for each authored module's rule tests. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advance,
  createGame,
  deploy,
  deploymentChoices,
  deploymentCost,
  effectiveHands,
  isActionCard,
  type FighterDefinition,
  type GameState,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import {
  BREAKTHROUGH_COMPATIBILITY,
  BREAKTHROUGH_ROSTER,
  BREAKTHROUGH_STARTER_DECKS,
} from './src/breakthroughCatalog';
import { cardCatalog } from './src/data';
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function fixture(card: FighterDefinition, lastStand: boolean): GameState {
  const deck = [
    card.id,
    ...BREAKTHROUGH_ROSTER.filter((c) => c.id !== card.id)
      .slice(0, 9)
      .map((c) => c.id),
  ];
  const s = createGame(BREAKTHROUGH_ROSTER, {
    seed: 71231,
    decks: { player: deck, opponent: deck },
    travelMs: 1e8,
  });
  s.elapsedMs = lastStand ? s.durationMs - 20000 : 0;
  if (lastStand) s.drawsLocked = true;
  for (const side of ['player', 'opponent'] as const) {
    s.players[side].hand = side === 'player' ? [card.id] : [];
    s.players[side].queue = [];
    s.players[side].motion = 9;
    s.players[side].nextDrawAt = 1e9;
  }
  for (const side of ['player', 'opponent'] as const)
    for (const lane of [0, 1, 2] as const) {
      const id = side === 'player' ? 'edgar' : 'nguyen',
        def = BREAKTHROUGH_ROSTER.find((c) => c.id === id)!;
      const u: Unit = {
        id: `fixture-${side}-${lane}`,
        cardId: id,
        side,
        lane,
        position: side === 'player' ? 0.1 : 0.9,
        hands: 12,
        baseHands: def.hands,
        maxHands: 16,
        damageTaken: 4,
        squabbled: false,
        nextEffectAt: 1e9,
        origin: 'deck',
      };
      s.units.push(u);
      s.units.push({
        ...u,
        id: `${u.id}-second`,
        cardId: 'racially-ambiguous-transplant',
      });
    }
  return s;
}
function invariant(s: GameState, context: string) {
  assert.equal(
    new Set(s.units.map((u) => u.id)).size,
    s.units.length,
    `${context}: instance ids`,
  );
  for (const side of ['player', 'opponent'] as Side[]) {
    assert(
      Number.isFinite(s.players[side].motion),
      `${context}: finite Motion`,
    );
    assert(
      s.players[side].motion >= -1e-8 && s.players[side].motion <= 9 + 1e-8,
      `${context}: Motion bounds`,
    );
    assert.equal(
      s.players[side].reinforcements.length,
      0,
      `${context}: no deployment wait`,
    );
  }
  for (const u of s.units) {
    assert(Number.isFinite(u.hands), `${context}: Hands`);
    assert(Number.isFinite(effectiveHands(u)), `${context}: effective Hands`);
    assert([0, 1, 2].includes(u.lane), `${context}: legal lane`);
    assert(u.position >= 0 && u.position <= 1, `${context}: track bounds`);
  }
}
test('canonical collectible registry is exact and every starter is now compatible', () => {
  assert.equal(cardCatalog.length, 301);
  assert.equal(BREAKTHROUGH_ROSTER.length, 301);
  assert.deepEqual(
    [...BREAKTHROUGH_ROSTER.map((c) => c.id)].sort(),
    cardCatalog.map((c) => c.catalogId).sort(),
  );
  assert(BREAKTHROUGH_COMPATIBILITY.every((c) => c.supported));
  assert.equal(BREAKTHROUGH_STARTER_DECKS.length, 15);
});
for (const card of BREAKTHROUGH_ROSTER)
  test(`${card.id}: legal instant deployment, rejection purity, Last Stand and JSON checkpoint determinism`, () => {
    for (const lastStand of [false, true]) {
      const initial = fixture(card, lastStand),
        before = copy(initial);
      const lane = ([0, 1, 2] as Lane[]).find((l) =>
        Number.isFinite(deploymentCost(initial, 'player', card.id, l)),
      )!;
      assert.notEqual(lane, undefined, `${card.id}: no legal lane`);
      const plan = deploymentChoices(initial, 'player', card.id, lane),
        choice = plan.options.find((o) => !o.disabled)?.value;
      const target = choice === undefined ? undefined : { choice };
      const apply = () =>
        deploy(initial, 'player', card.id, lane, false, target);
      const result = apply();
      assert.equal(result.error, undefined, `${card.id}: ${result.error}`);
      assert.deepEqual(initial, before, `${card.id}: input mutation`);
      assert.deepEqual(apply(), result, `${card.id}: deterministic activation`);
      assert.equal(
        result.state.elapsedMs,
        initial.elapsedMs,
        `${card.id}: instant deploy`,
      );
      assert.equal(result.state.commands.at(-1)?.cardId, card.id);
      if (isActionCard(card))
        assert(!result.state.units.some((u) => u.cardId === card.id));
      invariant(result.state, card.id);
      const bad = deploy(initial, 'player', card.id, 3 as Lane, false, target);
      assert(bad.error);
      assert.equal(bad.state, initial);
      assert.deepEqual(initial, before);
      const next = advance(result.state, 10100),
        restored = advance(copy(result.state), 10100);
      assert.deepEqual(restored, next, `${card.id}: checkpoint replay`);
      invariant(next, card.id);
    }
  });
