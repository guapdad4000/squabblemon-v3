import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardCatalog } from './src/data';
import type { Unit, Side, Lane } from './src/breakthrough';
import {
  SUPPORT_ADAPTERS,
  SUPPORT_DESCRIPTIONS,
  cloneSupportRuntime,
  createSupportRuntime,
  isSupportAbility,
  legalSupportTarget,
  pruneSupportRuntime,
  resolveSupportAction,
  supportCharacterDeployed,
  supportPreventEnemyDamage,
  supportProtectionConsumed,
  supportSuccessfulMove,
  type SupportAbility,
  type SupportGangColor,
  type SupportTools,
  type SupportView,
} from './src/breakthroughSupports';

function unit(
  id: string,
  side: Side = 'player',
  lane: Lane = 0,
  hands = 3,
  cardId = id,
): Unit {
  return {
    id,
    cardId,
    side,
    lane,
    position: side === 'player' ? 0.2 : 0.8,
    hands,
    baseHands: hands,
    maxHands: hands,
    squabbled: false,
    nextEffectAt: 100000,
  };
}
function fixture(units: Unit[] = []) {
  const runtime = createSupportRuntime();
  const elements = new Map<string, string>();
  const gangs = new Map<string, SupportGangColor>();
  const invalidMoves = new Set<string>();
  const notes: string[] = [];
  const motion = { player: 0, opponent: 0 };
  const view: SupportView = {
    elapsedMs: 0,
    units,
    element: (u) => elements.get(u.id),
    gangColor: (u) => gangs.get(u.id),
    effectiveHands: (u) => (u.frozen ? 0 : u.hands),
    isAfflicted: (u) =>
      !!(u.frozen || u.silenced || u.weakened || u.burnStacks),
    canMove: (u, lane) =>
      !u.frozen && u.lane !== lane && !invalidMoves.has(`${u.id}:${lane}`),
  };
  const tools: SupportTools = {
    gain(u, amount) {
      u.hands += amount;
      u.maxHands += amount;
    },
    protect(u) {
      if (u.protected) return false;
      u.protected = true;
      return true;
    },
    cleanse(u) {
      u.frozen = false;
      u.silenced = false;
      u.weakened = false;
      u.burnStacks = 0;
    },
    restoreMotion(side, amount) {
      motion[side] = Math.min(9, motion[side] + amount);
    },
    strike(u, amount) {
      if (u.immune) return;
      if (u.protected) {
        u.protected = false;
        supportProtectionConsumed(runtime, u, tools);
        return;
      }
      u.hands -= Math.max(
        0,
        amount - supportPreventEnemyDamage(runtime, u, amount),
      );
    },
    move(u, lane) {
      if (!view.canMove(u, lane)) return false;
      u.lane = lane;
      supportSuccessfulMove(view, runtime, u, tools);
      return true;
    },
    setGangColor(u, color) {
      gangs.set(u.id, color);
    },
    note(text) {
      notes.push(text);
    },
  };
  const play = (
    ability: SupportAbility,
    side: Side = 'player',
    lane: Lane = 0,
  ) => resolveSupportAction(view, runtime, ability, side, lane, tools);
  return {
    runtime,
    elements,
    gangs,
    invalidMoves,
    notes,
    motion,
    view,
    tools,
    play,
  };
}

test('the remaining ten support mappings use final canonical support identities and concrete action rules', () => {
  assert.equal(Object.keys(SUPPORT_ADAPTERS).length, 10);
  const alreadyImplemented = new Set([
    'bus-pass',
    'soul-food',
    'cognac-bottle',
  ]);
  const expected = cardCatalog
    .filter((c) => c.kind === 'support' && !alreadyImplemented.has(c.catalogId))
    .map((c) => c.catalogId)
    .sort();
  assert.deepEqual(Object.keys(SUPPORT_ADAPTERS).sort(), expected);
  for (const spec of Object.values(SUPPORT_ADAPTERS)) {
    assert.ok(SUPPORT_DESCRIPTIONS[spec.ability]);
    assert.equal(isSupportAbility(spec.ability), true);
  }
  assert.equal(isSupportAbility('none'), false);
  assert.equal(isSupportAbility('__proto__'), false);
  assert.equal(isSupportAbility(undefined), false);
});

test('automatic picks use living local friendly fighters, effective Hands, and stable identity ties', () => {
  const a = unit('a', 'player', 0, 2),
    b = unit('b', 'player', 0, 8);
  b.frozen = true;
  const f = fixture([
    unit('dead', 'player', 0, 0),
    unit('remote', 'player', 1, 1),
    unit('enemy', 'opponent', 0, 1),
    a,
    b,
  ]);
  assert.equal(
    legalSupportTarget(f.view, f.runtime, 'stand-firm', 'player', 0)
      .targetUnitId,
    'b',
  );
  b.frozen = false;
  b.hands = 2;
  assert.equal(
    legalSupportTarget(f.view, f.runtime, 'stand-firm', 'player', 0)
      .targetUnitId,
    'a',
  );
});

test('invalid and stale support plans leave both persistent state and effects untouched', () => {
  const empty = fixture();
  const before = JSON.stringify(empty.runtime);
  for (const ability of [
    'wrist-check',
    'emergency-kit',
    'alternate-route',
    'stand-firm',
    'side-order',
    'bad-intentions',
  ] as const)
    assert.equal(empty.play(ability).valid, false);
  assert.equal(JSON.stringify(empty.runtime), before);
  assert.deepEqual(empty.notes, []);
  const a = unit('a', 'player', 0, 3),
    b = unit('b', 'player', 0, 4);
  const f = fixture([a, b]);
  const plan = legalSupportTarget(
    f.view,
    f.runtime,
    'wrist-check',
    'player',
    0,
  );
  b.hands = 1;
  const snapshot = JSON.stringify({ units: f.view.units, runtime: f.runtime });
  assert.equal(
    resolveSupportAction(
      f.view,
      f.runtime,
      'wrist-check',
      'player',
      0,
      f.tools,
      plan,
    ).valid,
    false,
  );
  assert.equal(
    JSON.stringify({ units: f.view.units, runtime: f.runtime }),
    snapshot,
  );
  assert.equal(
    legalSupportTarget(f.view, f.runtime, 'stand-firm', 'player', 4 as Lane)
      .valid,
    false,
  );
  assert.equal(
    legalSupportTarget(f.view, f.runtime, 'stand-firm', 'intruder' as Side, 0)
      .valid,
    false,
  );
});

test('Wrist Check pays once only for the personal ward that it newly granted', () => {
  const a = unit('a');
  const f = fixture([a]);
  assert.equal(f.play('wrist-check').valid, true);
  assert.equal(a.hands, 4);
  assert.equal(a.protected, true);
  assert.equal(f.runtime.watches.length, 1);
  // Immunity or a lane shield would never invoke this hook.
  a.protected = false;
  supportProtectionConsumed(f.runtime, a, f.tools);
  assert.equal(a.hands, 6);
  assert.equal(f.runtime.watches.length, 0);
  supportProtectionConsumed(f.runtime, a, f.tools);
  assert.equal(a.hands, 6);
  // An already-protected wearer gets the printed +1 but no Watch claim.
  a.protected = true;
  f.play('wrist-check');
  assert.equal(a.hands, 7);
  assert.equal(f.runtime.watches.length, 0);
  a.protected = false;
  supportProtectionConsumed(f.runtime, a, f.tools);
  assert.equal(a.hands, 7);
});

test('Second Wind refunds three after payment and never exceeds the Motion cap', () => {
  const f = fixture();
  f.motion.player = 1;
  f.play('second-wind');
  assert.equal(f.motion.player, 4);
  f.motion.player = 8.5;
  f.play('second-wind');
  assert.equal(f.motion.player, 9);
  assert.equal(f.motion.opponent, 0);
  assert.equal(f.runtime.kits.length, 0);
  assert.equal(f.view.units.length, 0);
});

test('Phone Charger counts local living allies, refunds at most three and protects the weakest Electric only at three', () => {
  const a = unit('a', 'player', 0, 5),
    b = unit('b', 'player', 0, 2);
  const f = fixture([
    a,
    b,
    unit('enemy', 'opponent'),
    unit('away', 'player', 1),
    unit('dead', 'player', 0, 0),
  ]);
  f.elements.set(a.id, 'Electric');
  f.elements.set(b.id, 'Electric');
  f.play('refund');
  assert.equal(f.motion.player, 2);
  assert.equal(b.protected, undefined);
  const c = unit('c');
  (f.view.units as Unit[]).push(c);
  f.play('refund');
  assert.equal(f.motion.player, 5);
  assert.equal(b.protected, true);
  assert.equal(a.protected, undefined);
  (f.view.units as Unit[]).push(unit('d'));
  f.play('refund');
  assert.equal(f.motion.player, 8);
});

test('Emergency Kit prioritizes afflicted allies, cleanses every harmful status, and does not heal or stack', () => {
  const weak = unit('weak', 'player', 0, 1),
    sick = unit('sick', 'player', 0, 8);
  sick.burnStacks = 4;
  sick.silenced = true;
  sick.weakened = true;
  const f = fixture([weak, sick]);
  assert.equal(f.play('emergency-kit').targetUnitId, sick.id);
  assert.equal(sick.hands, 8);
  assert.equal(sick.silenced, false);
  assert.equal(sick.weakened, false);
  assert.equal(sick.burnStacks, 0);
  assert.equal(f.runtime.kits[0].targetId, sick.id);
  sick.burnStacks = 1;
  f.play('emergency-kit');
  assert.equal(f.runtime.kits.length, 1);
  assert.equal(sick.burnStacks, 0);
  assert.equal(supportPreventEnemyDamage(f.runtime, sick, 0), 0);
  assert.equal(f.runtime.kits.length, 1);
  assert.equal(supportPreventEnemyDamage(f.runtime, sick, 10), 2);
  assert.equal(f.runtime.kits.length, 0);
  assert.equal(supportPreventEnemyDamage(f.runtime, sick, 10), 0);
});

test('Emergency Kit prevents before lethal, consumes on a one-Hand hit, and is not a permanent damage reduction', () => {
  const a = unit('a', 'player', 0, 1);
  const f = fixture([a]);
  f.play('emergency-kit');
  f.tools.strike(a, 2, {
    cardId: 'a-side-of-hands',
    side: 'opponent',
    lane: 0,
  });
  assert.equal(a.hands, 1);
  assert.equal(f.runtime.kits.length, 0);
  f.play('emergency-kit');
  assert.equal(supportPreventEnemyDamage(f.runtime, a, 1), 1);
  assert.equal(f.runtime.kits.length, 0);
  assert.equal(supportPreventEnemyDamage(f.runtime, a, 2), 0);
});

test('Boombox buffs every local ally and leaves one source-independent Encore consumed by a lane arrival', () => {
  const a = unit('a'),
    b = unit('b'),
    mover = unit('mover', 'player', 1);
  const f = fixture([a, b, mover]);
  f.play('turn-it-up');
  assert.equal(a.hands, 4);
  assert.equal(b.hands, 4);
  assert.equal(mover.hands, 3);
  assert.equal(f.runtime.encores.length, 1);
  assert.equal(f.runtime.encores[0].expiresAt, 20000);
  supportCharacterDeployed(f.view, f.runtime, a, f.tools);
  assert.equal(f.runtime.encores.length, 1);
  f.tools.move(mover, 0, { cardId: 'subway-map', side: 'player', lane: 1 });
  assert.equal(mover.hands, 4);
  assert.equal(f.runtime.encores.length, 0);
  supportSuccessfulMove(f.view, f.runtime, mover, f.tools);
  assert.equal(mover.hands, 4);
});

test('Encore can be planted in an empty lane, does not stack, and expires precisely on the next-interval boundary', () => {
  const a = unit('a', 'player', 1);
  const f = fixture([a]);
  f.view.elapsedMs = 19999;
  assert.equal(f.play('turn-it-up').valid, true);
  assert.equal(f.runtime.encores[0].expiresAt, 30000);
  f.play('turn-it-up');
  assert.equal(f.runtime.encores.length, 1);
  f.view.elapsedMs = 30000;
  f.tools.move(a, 0, { cardId: 'subway-map', side: 'player', lane: 1 });
  assert.equal(a.hands, 3);
  pruneSupportRuntime(f.view, f.runtime);
  assert.equal(f.runtime.encores.length, 0);
});

test('Subway Map targets the weakest ally and actual weakest other lane, preserving progress and buffing only after movement', () => {
  const a = unit('a', 'player', 0, 2),
    b = unit('b', 'player', 0, 4);
  const f = fixture([a, b, unit('strong-away', 'player', 1, 8)]);
  const progress = a.position;
  const plan = legalSupportTarget(
    f.view,
    f.runtime,
    'alternate-route',
    'player',
    0,
  );
  assert.equal(plan.targetUnitId, a.id);
  assert.equal(plan.destinationLane, 2);
  assert.equal(f.play('alternate-route').valid, true);
  assert.equal(a.lane, 2);
  assert.equal(a.position, progress);
  assert.equal(a.hands, 3);
  assert.equal(b.lane, 0);
});

test('Subway Map cannot choose a stronger alternate lane to evade a blocked canonical destination or move a frozen target', () => {
  const a = unit('a', 'player', 0, 2);
  const f = fixture([a, unit('away', 'player', 2, 9)]);
  f.invalidMoves.add('a:1');
  assert.equal(f.play('alternate-route').valid, false);
  assert.equal(a.lane, 0);
  assert.equal(a.hands, 2);
  f.invalidMoves.clear();
  a.frozen = true;
  assert.equal(f.play('alternate-route').valid, false);
  assert.equal(a.lane, 0);
  assert.equal(a.hands, 2);
});

test('Buttahs gives two Hands and personal Protection to the canonical weakest ally', () => {
  const a = unit('a', 'player', 0, 1),
    b = unit('b', 'player', 0, 3);
  const f = fixture([a, b]);
  f.play('stand-firm');
  assert.equal(a.hands, 3);
  assert.equal(a.protected, true);
  assert.equal(b.hands, 3);
  assert.equal(b.protected, undefined);
  assert.equal(f.runtime.watches.length, 0);
});

test('Side Order applies its friendly half even when the hostile half is Protected or immune', () => {
  const a = unit('a', 'player', 0, 1),
    enemy = unit('enemy', 'opponent', 0, 8);
  enemy.protected = true;
  const f = fixture([a, enemy]);
  f.play('side-order');
  assert.equal(a.hands, 3);
  assert.equal(enemy.hands, 8);
  assert.equal(enemy.protected, false);
  enemy.immune = true;
  f.play('side-order');
  assert.equal(a.hands, 5);
  assert.equal(enemy.hands, 8);
  enemy.immune = false;
  f.play('side-order');
  assert.equal(a.hands, 7);
  assert.equal(enemy.hands, 6);
});

test('Side Order may resolve with only one half present and never demands an invented target', () => {
  const enemy = unit('enemy', 'opponent', 0, 8);
  const f = fixture([enemy]);
  const plan = f.play('side-order');
  assert.equal(plan.valid, true);
  assert.equal(plan.targetUnitId, undefined);
  assert.equal(plan.enemyUnitId, enemy.id);
  assert.equal(enemy.hands, 6);
  const a = unit('a');
  const friendly = fixture([a]);
  friendly.play('side-order');
  assert.equal(a.hands, 5);
});

test('Bad Intentions fits each friendly identity once per match and rewards its first move before the current pulse ends', () => {
  const a = unit('a', 'player', 0, 1, 'shared-card'),
    b = unit('b', 'player', 0, 4);
  const f = fixture([a, b]);
  f.view.elapsedMs = 9000;
  f.play('bad-intentions');
  assert.equal(a.hands, 2);
  assert.equal(a.protected, true);
  assert.equal(f.runtime.fittings[0].expiresAt, 10000);
  f.tools.move(a, 1, { cardId: 'subway-map', side: 'player', lane: 0 });
  assert.equal(a.hands, 3);
  assert.equal(f.runtime.fittings.length, 0);
  f.tools.move(a, 0, { cardId: 'subway-map', side: 'player', lane: 1 });
  assert.equal(a.hands, 3);
  assert.equal(
    legalSupportTarget(f.view, f.runtime, 'bad-intentions', 'player', 0)
      .targetUnitId,
    b.id,
  );
  a.hands = 0;
  pruneSupportRuntime(f.view, f.runtime);
  const returned = unit('returned', 'player', 2, 1, 'shared-card');
  (f.view.units as Unit[]).push(returned);
  assert.equal(f.play('bad-intentions', 'player', 2).valid, false);
  const opposing = unit('opposing', 'opponent', 2, 1, 'shared-card');
  (f.view.units as Unit[]).push(opposing);
  assert.equal(f.play('bad-intentions', 'opponent', 2).valid, true);
});

test('Bad Intentions expiry and unsuccessful movement cannot pay the extra Hand', () => {
  const a = unit('a');
  const f = fixture([a]);
  f.play('bad-intentions');
  f.invalidMoves.add('a:1');
  assert.equal(
    f.tools.move(a, 1, { cardId: 'subway-map', side: 'player', lane: 0 }),
    false,
  );
  assert.equal(a.hands, 4);
  assert.equal(f.runtime.fittings.length, 1);
  f.view.elapsedMs = 10000;
  f.invalidMoves.clear();
  f.tools.move(a, 1, { cardId: 'subway-map', side: 'player', lane: 0 });
  assert.equal(a.hands, 4);
  assert.equal(f.runtime.fittings.length, 0);
});

test('Initiation persists until a paid local character arrives, grants two before its ability, and uses the local majority set', () => {
  const a = unit('a'),
    b = unit('b'),
    red = unit('red');
  const entrant = unit('entrant', 'player', 0, 3);
  const f = fixture([a, b, red, entrant]);
  f.gangs.set(a.id, 'blue');
  f.gangs.set(b.id, 'blue');
  f.gangs.set(red.id, 'red');
  f.play('marked-territory');
  assert.equal(f.play('marked-territory').valid, false);
  f.view.elapsedMs = 170000;
  pruneSupportRuntime(f.view, f.runtime);
  assert.equal(f.runtime.territory.length, 1);
  const unrelated = unit('unrelated', 'player', 1);
  supportCharacterDeployed(f.view, f.runtime, unrelated, f.tools);
  assert.equal(f.runtime.territory.length, 1);
  supportCharacterDeployed(f.view, f.runtime, entrant, f.tools);
  assert.equal(entrant.hands, 5);
  assert.equal(f.gangs.get(entrant.id), 'blue');
  assert.equal(f.runtime.territory.length, 0);
  supportCharacterDeployed(f.view, f.runtime, entrant, f.tools);
  assert.equal(entrant.hands, 5);
});

test('Initiation does not invent set membership on empty or tied lanes and is isolated per side and lane', () => {
  for (const tie of [false, true]) {
    const entrant = unit('entrant'),
      f = fixture([entrant]);
    f.gangs.set(entrant.id, 'red');
    if (tie) {
      const b = unit('blue'),
        r = unit('red');
      (f.view.units as Unit[]).push(b, r);
      f.gangs.set(b.id, 'blue');
      f.gangs.set(r.id, 'red');
    }
    f.play('marked-territory');
    f.play('marked-territory', 'opponent', 0);
    f.play('marked-territory', 'player', 1);
    supportCharacterDeployed(f.view, f.runtime, entrant, f.tools);
    assert.equal(entrant.hands, 5);
    assert.equal(f.gangs.get(entrant.id), 'red');
    assert.equal(f.runtime.territory.length, 2);
  }
});

test('runtime clones own all nested contracts and pruning removes dead/expired targets but preserves match receipts and territory', () => {
  const a = unit('a'),
    f = fixture([a]);
  f.play('wrist-check');
  f.play('emergency-kit');
  f.play('turn-it-up');
  f.play('bad-intentions');
  f.play('marked-territory');
  const copy = cloneSupportRuntime(f.runtime);
  copy.watches[0].targetId = 'mutated';
  copy.kits[0].targetId = 'mutated';
  copy.encores[0].expiresAt = 0;
  copy.fittings[0].expiresAt = 0;
  copy.territory[0].lane = 2;
  copy.fittedCards['x:y'] = true;
  assert.equal(f.runtime.watches[0].targetId, a.id);
  assert.equal(f.runtime.kits[0].targetId, a.id);
  assert.equal(f.runtime.encores[0].expiresAt, 20000);
  assert.equal(f.runtime.fittings[0].expiresAt, 10000);
  assert.equal(f.runtime.territory[0].lane, 0);
  assert.equal(f.runtime.fittedCards['x:y'], undefined);
  a.hands = 0;
  f.view.elapsedMs = 20000;
  pruneSupportRuntime(f.view, f.runtime);
  assert.equal(f.runtime.watches.length, 0);
  assert.equal(f.runtime.kits.length, 0);
  assert.equal(f.runtime.fittings.length, 0);
  assert.equal(f.runtime.encores.length, 0);
  assert.equal(f.runtime.territory.length, 1);
  assert.equal(f.runtime.fittedCards['player:a'], true);
  assert.deepEqual(cloneSupportRuntime(), createSupportRuntime());
});
