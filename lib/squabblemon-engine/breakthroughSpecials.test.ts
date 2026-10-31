import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cardCatalog } from './src/data';
import type { GameState, Lane, Side, Unit } from './src/breakthrough';
import {
  SPECIAL_ADAPTERS,
  SPECIAL_ABILITY_DESCRIPTIONS,
  SPECIAL_ARTWORK,
  SPECIAL_TOKEN_DEFINITIONS,
  specialsCanRepeat,
  specialsEntrance,
  specialsEntranceResolved,
  specialsPlayed,
  specialsMoved,
  specialsCaptureReturn,
  specialsReturned,
  specialsDiscount,
  specialsSpendDiscount,
  specialsProtectionConsumed,
  specialsAfterBoardChange,
  specialsTick,
  cloneSpecialsRuntime,
  type SpecialsContext,
  type SpecialDefinition,
} from './src/breakthroughSpecials';
function harness() {
  const definitions = new Map<string, SpecialDefinition>(
    cardCatalog.map((c) => [
      c.catalogId,
      {
        id: c.catalogId,
        engineId: c.id,
        kind: c.kind ?? 'character',
        cost: c.cost,
        hands: c.power,
        element: c.type,
        ability:
          (SPECIAL_ADAPTERS as Record<string, { ability: string }>)[c.catalogId]
            ?.ability ?? 'outside',
        triggers: [
          ...(c.effect.includes('On Reveal') ? ['entrance'] : []),
          ...(c.effect.includes('Ongoing:') ? ['ongoing'] : []),
        ],
      },
    ]),
  );
  for (const d of SPECIAL_TOKEN_DEFINITIONS) definitions.set(d.id, { ...d });
  const seat = () => ({
    motion: 4,
    hand: [] as string[],
    queue: [],
    reinforcements: [],
    breaches: 0,
    squabbleUsed: false,
    returns: [],
    nextDrawAt: 3000,
    returnedHands: {},
  });
  const state = {
    elapsedMs: 0,
    durationMs: 180000,
    units: [],
    roster: [],
    events: [],
    nextEventId: 1,
    players: { player: seat(), opponent: seat() },
  } as unknown as GameState;
  let next = 1,
    final = false,
    redirect: Unit | undefined,
    reenter = false,
    landBlocked = false;
  const blocked = new Set<string>(),
    repeats: { actor: string; cardId: string; coach: boolean }[] = [],
    repeatHandlers = new Map<string, (actor: Unit) => boolean>(),
    hits: { source: string; target: string; amount: number }[] = [],
    recruits: { source: string; target: string }[] = [];
  const live = (u: Unit) =>
    state.units.some((v) => v.id === u.id && v.hands > 0);
  const defended = (
    source: Unit,
    target: Unit,
    apply: (actual: Unit) => void,
  ) => {
    const actual = redirect ?? target;
    if (actual.immune) return false;
    if (actual.protected) {
      actual.protected = false;
      specialsProtectionConsumed(ctx, actual, source, true);
      return false;
    }
    apply(actual);
    return true;
  };
  const ctx: SpecialsContext = {
    state,
    definition: (u) =>
      definitions.get(
        (u as Unit & { copiedAbility?: string }).copiedAbility ?? u.cardId,
      ) ?? {
        id: u.cardId,
        cost: 2,
        hands: u.baseHands,
        kind: 'character',
        element: 'Normal',
        ability: 'outside',
        triggers: ['entrance'],
      },
    baseDefinition: (id) => definitions.get(id),
    active: (u) => live(u) && !u.frozen && !u.silenced && !u.weakened,
    power: (u) => (u.frozen ? 0 : Math.max(0, u.hands)),
    gain(u, n) {
      if (live(u) && n > 0) {
        u.hands += n;
        u.maxHands += n;
      }
    },
    damage(source, target, n) {
      let actual = 0;
      defended(source, target, (v) => {
        actual = Math.min(n, Math.max(0, v.hands));
        v.hands -= actual;
        hits.push({ source: source.id, target: v.id, amount: actual });
      });
      return actual;
    },
    protect(_source, target) {
      const changed = !target.protected;
      target.protected = true;
      return changed;
    },
    cleanse(u, kinds) {
      let changed = false;
      for (const [kind, flag] of [
        ['freeze', 'frozen'],
        ['silence', 'silenced'],
        ['weaken', 'weakened'],
      ] as const)
        if ((!kinds || kinds.includes(kind)) && u[flag]) {
          u[flag] = false;
          changed = true;
        }
      if ((!kinds || kinds.includes('burn')) && u.burnStacks) {
        u.burnStacks = 0;
        changed = true;
      }
      if (!kinds && u.movementLocks?.length) {
        u.movementLocks = [];
        changed = true;
      }
      return changed;
    },
    freeze(source, target) {
      return defended(source, target, (v) => {
        v.frozen = true;
      });
    },
    openForMove(u, lane) {
      return (
        live(u) &&
        !u.frozen &&
        !u.movementLocks?.some((m) => m.expiresAt > state.elapsedMs) &&
        !blocked.has(`${u.id}:${lane}`)
      );
    },
    enemyMove(source, target, lane, afterMoved) {
      let moved = false;
      const passed = defended(source, target, (v) => {
        if (v.lane !== lane && ctx.openForMove(v, lane)) {
          v.lane = lane;
          moved = true;
          afterMoved?.(v);
        }
      });
      return passed && moved;
    },
    spawn(source, cardId, lane) {
      const d = definitions.get(cardId)!;
      const token = unit(cardId, lane, d.hands, source.side);
      token.origin = 'summon';
      token.sourceUnitId = source.id;
      token.position = source.side === 'player' ? 0 : 1;
      if (cardId === 'guyana') token.immune = true;
      return token;
    },
    copyOngoing(source, target, copyAbility) {
      const base = Math.min(7, target.baseHands),
        delta = source.hands - source.baseHands,
        maxDelta = source.maxHands - source.baseHands;
      source.baseHands = base;
      source.hands = base + delta;
      source.maxHands = base + maxDelta;
      if (copyAbility)
        (source as Unit & { copiedAbility?: string }).copiedAbility =
          target.cardId;
      return true;
    },
    repeat(actor, cardId, options = {}) {
      repeats.push({ actor: actor.id, cardId, coach: !!options.coach });
      return repeatHandlers.get(cardId)?.(actor) ?? false;
    },
    disappear(u) {
      if (!live(u)) return false;
      state.units = state.units.filter((v) => v.id !== u.id);
      return true;
    },
    land(saved, lane, form) {
      if (landBlocked) return;
      const oldBase = saved.baseHands;
      saved.hands = form.baseHands + (saved.hands - oldBase);
      saved.maxHands = form.baseHands + (saved.maxHands - oldBase);
      saved.baseHands = form.baseHands;
      saved.art = form.art;
      saved.lane = lane;
      saved.position = saved.side === 'player' ? 0 : 1;
      state.units.push(saved);
      return saved;
    },
    recruit(source, target) {
      let changed = false;
      const passed = defended(source, target, (actual) => {
        if (actual.id !== target.id) return;
        actual.side = source.side;
        changed = true;
        recruits.push({ source: source.id, target: actual.id });
        if (reenter) specialsAfterBoardChange(ctx);
      });
      return passed && changed;
    },
    lastStand: () => final || state.elapsedMs >= state.durationMs - 30000,
    event: (e) => state.events.push({ ...e, id: state.nextEventId++ }),
  };
  function unit(
    cardId: string,
    lane: Lane = 0,
    hands = 4,
    side: Side = 'player',
  ): Unit {
    if (!definitions.has(cardId))
      definitions.set(cardId, {
        id: cardId,
        engineId: cardId,
        kind: 'character',
        cost: 2,
        hands,
        element: 'Normal',
        ability: 'outside',
        triggers: ['entrance'],
      });
    const u: Unit = {
      id: `u${next++}`,
      cardId,
      side,
      lane,
      position: side === 'player' ? 0.2 : 0.8,
      hands,
      baseHands: hands,
      maxHands: hands,
      squabbled: false,
      nextEffectAt: 5000,
    };
    state.units.push(u);
    return u;
  }
  function custom(id: string, patch: Partial<SpecialDefinition>) {
    definitions.set(id, {
      id,
      engineId: id,
      kind: 'character',
      cost: 2,
      hands: 4,
      element: 'Normal',
      ability: 'outside',
      triggers: ['entrance'],
      ...patch,
    });
  }
  function entrance(u: Unit, success?: boolean) {
    const result = success ?? specialsEntrance(ctx, u) === true;
    u.entranceSucceeded = result;
    specialsEntranceResolved(ctx, u, result);
    return result;
  }
  function returned(u: Unit) {
    const before = specialsCaptureReturn(ctx, u);
    state.units = state.units.filter((v) => v.id !== u.id);
    state.players[u.side].hand.push(u.cardId);
    specialsReturned(ctx, before);
  }
  return {
    ctx,
    state,
    unit,
    custom,
    definitions,
    blocked,
    repeats,
    repeatHandlers,
    hits,
    recruits,
    entrance,
    returned,
    final() {
      final = true;
    },
    redirect(u?: Unit) {
      redirect = u;
    },
    reentrant() {
      reenter = true;
    },
    landBlocked(v: boolean) {
      landBlocked = v;
    },
  };
}

test('13 exact canonical adapters expose full contracts, correct triggers and actual existing summon art', () => {
  assert.equal(Object.keys(SPECIAL_ADAPTERS).length, 13);
  for (const [id, a] of Object.entries(SPECIAL_ADAPTERS)) {
    const c = cardCatalog.find((c) => c.catalogId === id);
    assert.ok(c, id);
    assert.ok(SPECIAL_ABILITY_DESCRIPTIONS[a.ability].length > 80);
    assert.ok(a.triggers.length);
  }
  for (const d of SPECIAL_TOKEN_DEFINITIONS) {
    assert.equal(d.kind, 'token');
    assert.equal('cannotLoseHands' in d, false);
    assert.equal(
      cardCatalog.some((c) => c.catalogId === d.id),
      false,
    );
    assert.ok(
      existsSync(resolve('artifacts/squabblemon/public', d.art.slice(1))),
      d.art,
    );
  }
  assert.ok(
    existsSync(
      resolve(
        'artifacts/squabblemon/public',
        SPECIAL_ARTWORK.elephant.slice(1),
      ),
    ),
  );
});
test('Scammer selects strongest active Ongoing first and keeps signed investment/damage delta without an entrance', () => {
  const h = harness(),
    s = h.unit('scammer', 0, 3),
    ongoing = h.unit('watcher', 0, 6, 'opponent'),
    stronger = h.unit('ordinary', 0, 20, 'opponent');
  h.custom('watcher', { triggers: ['ongoing'], ability: 'watcher' });
  s.hands = 1;
  s.maxHands = 5;
  ongoing.baseHands = 10;
  assert.equal(specialsEntrance(h.ctx, s), true);
  assert.equal(s.baseHands, 7);
  assert.equal(s.hands, 5);
  assert.equal(s.maxHands, 9);
  assert.equal(
    (s as Unit & { copiedAbility?: string }).copiedAbility,
    'watcher',
  );
  assert.equal(s.cardId, 'scammer');
  assert.equal(h.repeats.length, 0);
  assert.equal(stronger.hands, 20);
});
test('Scammer fallback excludes disabled Ongoing and copies base, never buffed Hands; no enemy genuinely fails', () => {
  const h = harness(),
    s = h.unit('scammer', 0, 3),
    target = h.unit('watcher', 0, 30, 'opponent');
  h.custom('watcher', { triggers: ['ongoing'] });
  target.silenced = true;
  target.baseHands = 4;
  assert.equal(specialsEntrance(h.ctx, s), true);
  assert.equal(s.hands, 5);
  assert.equal(
    (s as Unit & { copiedAbility?: string }).copiedAbility,
    undefined,
  );
  const e = harness();
  assert.equal(specialsEntrance(e.ctx, e.unit('scammer')), false);
});
test('Scammer uses Freeze-zero effective Hands when ordering active targets', () => {
  const h = harness(),
    s = h.unit('scammer'),
    frozen = h.unit('frozen', 0, 20, 'opponent'),
    live = h.unit('live', 0, 3, 'opponent');
  frozen.frozen = true;
  frozen.baseHands = 7;
  live.baseHands = 2;
  specialsEntrance(h.ctx, s);
  assert.equal(s.baseHands, 2);
});
test('Tayaty gains1 and uses last resolved failed entrance as its own source without replaying placement', () => {
  const h = harness(),
    previous = h.unit('edgar', 0, 2);
  h.entrance(previous, false);
  h.repeatHandlers.set('edgar', (actor) => {
    h.ctx.gain(actor, 2);
    return true;
  });
  const tayaty = h.unit('bad-lil-cousin-tayaty', 1, 3);
  assert.equal(specialsEntrance(h.ctx, tayaty), true);
  assert.equal(tayaty.hands, 6);
  assert.deepEqual(h.repeats, [
    { actor: tayaty.id, cardId: 'edgar', coach: false },
  ]);
  assert.equal(previous.hands, 2);
});
test('Tayaty fallback Protection applies to absent, copy, and persistent contract predecessors', () => {
  for (const prior of [
    undefined,
    'oz',
    'scammer',
    'corner-coach',
    'failed-rapper',
    'the-manager-evil',
  ]) {
    const h = harness();
    if (prior) {
      const u = h.unit(prior);
      h.entrance(u, false);
    }
    const s = h.unit('bad-lil-cousin-tayaty', 0, 3);
    specialsEntrance(h.ctx, s);
    assert.equal(s.hands, 4, prior);
    assert.equal(s.protected, true, prior);
    assert.equal(h.repeats.length, 0, prior);
  }
});
test('Copy eligibility is explicit: allowed direct kits, blocked persistent creative contracts and non-entrances', () => {
  const h = harness();
  for (const id of [
    'bboy',
    'barber-bro',
    'abuela',
    'block-party-titan',
    'lion',
    'edgar',
  ])
    assert.equal(specialsCanRepeat(h.definitions.get(id)), true, id);
  for (const id of [
    'oz',
    'scammer',
    'bad-lil-cousin-tayaty',
    'lebron-james',
    'inmate-kingpin',
    'dmv-worker',
    'ice-cream-truck',
    'boombox',
  ])
    assert.equal(specialsCanRepeat(h.definitions.get(id)), false, id);
  assert.equal(
    specialsCanRepeat({
      id: 'support',
      cost: 1,
      hands: 0,
      kind: 'support',
      triggers: ['entrance'],
    }),
    false,
  );
  assert.equal(
    specialsCanRepeat({
      id: 'passive',
      cost: 1,
      hands: 1,
      triggers: ['ongoing'],
    }),
    false,
  );
});
test('Coach retries failed eligible trainee on later friendly plays until success, then retires', () => {
  const h = harness(),
    trainee = h.unit('edgar', 0, 1);
  h.entrance(trainee, false);
  const coach = h.unit('corner-coach', 0, 2);
  h.entrance(coach);
  specialsPlayed(h.ctx, coach);
  assert.equal(h.repeats.length, 0);
  h.repeatHandlers.set('edgar', () => false);
  specialsPlayed(h.ctx, h.unit('visitor', 1));
  assert.equal(h.repeats.length, 1);
  assert.equal(h.state.specials?.coaches.length, 1);
  h.repeatHandlers.set('edgar', (actor) => {
    h.ctx.gain(actor, 2);
    return true;
  });
  specialsPlayed(h.ctx, h.unit('second', 2));
  assert.equal(trainee.hands, 3);
  assert.equal(h.state.specials?.coaches.length, 0);
  specialsPlayed(h.ctx, h.unit('third'));
  assert.equal(h.repeats.length, 2);
});
test('Coach respects trainee activity, expiry and actual failed entrance; fallback gives weakest local ally3', () => {
  const h = harness(),
    trainee = h.unit('edgar', 0, 1);
  trainee.entranceSucceeded = false;
  specialsEntrance(h.ctx, h.unit('corner-coach'));
  trainee.frozen = true;
  specialsPlayed(h.ctx, h.unit('visitor'));
  assert.equal(h.repeats.length, 0);
  trainee.frozen = false;
  h.state.elapsedMs = 20000;
  specialsPlayed(h.ctx, h.unit('late'));
  assert.equal(h.repeats.length, 0);
  const e = harness(),
    ally = e.unit('ordinary', 0, 1);
  assert.equal(specialsEntrance(e.ctx, e.unit('corner-coach')), true);
  assert.equal(ally.hands, 4);
  assert.equal(e.state.specials?.coaches.length, 0);
});
test('Coach cannot retrigger on trainee own play or echoed placement and does not need its caster present', () => {
  const h = harness(),
    trainee = h.unit('edgar');
  trainee.entranceSucceeded = false;
  const coach = h.unit('corner-coach');
  specialsEntrance(h.ctx, coach);
  h.state.units = h.state.units.filter((u) => u.id !== coach.id);
  specialsPlayed(h.ctx, trainee);
  specialsPlayed(h.ctx, h.unit('echo'), { echoed: true });
  assert.equal(h.repeats.length, 0);
  specialsPlayed(h.ctx, h.unit('real'));
  assert.equal(h.repeats.length, 1);
});
test('Ashlee uses real uncounterable Guyana, character-only local buffs and Plant spread including self', () => {
  const h = harness(),
    s = h.unit('ashlee', 0, 2),
    local = h.unit('local', 0, 2),
    plant = h.unit('sprout', 1, 1),
    token = h.unit('grin', 0, 4),
    enemy = h.unit('enemy', 2, 7, 'opponent');
  h.custom('local', { element: 'Air' });
  assert.equal(specialsEntrance(h.ctx, s), true);
  const gorilla = h.state.units.find((u) => u.cardId === 'guyana')!;
  assert.equal(gorilla.lane, 2);
  assert.equal(gorilla.hands, 4);
  assert.equal(gorilla.immune, true);
  assert.equal(gorilla.origin, 'summon');
  assert.equal(gorilla.position, 0);
  assert.equal(local.hands, 3);
  assert.equal(token.hands, 4);
  assert.equal(s.hands, 4);
  assert.equal(plant.hands, 3);
  assert.equal(enemy.hands, 6);
});
test('Ashlee spread needs2 Plant lanes, uses Freeze-zero selection and normal hostile defenses', () => {
  const h = harness(),
    s = h.unit('ashlee', 0, 2),
    frozen = h.unit('sprout', 0, 5),
    enemy = h.unit('enemy', 0, 8, 'opponent');
  frozen.frozen = true;
  enemy.protected = true;
  specialsEntrance(h.ctx, s);
  assert.equal(s.hands, 2);
  assert.equal(frozen.hands, 6);
  assert.equal(enemy.hands, 8);
  assert.equal(enemy.protected, false);
});
test('Jigga summons two Stewards, hits different targets and buffs lowest other Air character after each hit', () => {
  const h = harness(),
    s = h.unit('captain-jigga', 0, 3),
    air = h.unit('air', 0, 1),
    nonair = h.unit('nonair', 0, 1),
    a = h.unit('a', 0, 8, 'opponent'),
    b = h.unit('b', 0, 7, 'opponent');
  h.custom('air', { element: 'Air' });
  specialsEntrance(h.ctx, s);
  assert.equal(h.state.units.filter((u) => u.cardId === 'steward').length, 2);
  assert.equal(a.hands, 6);
  assert.equal(b.hands, 5);
  assert.equal(air.hands, 3);
  assert.equal(nonair.hands, 1);
  assert.equal(s.hands, 3);
  assert.deepEqual(new Set(h.hits.map((x) => x.target)), new Set([a.id, b.id]));
  for (const hit of h.hits)
    assert.equal(
      h.state.units.find((u) => u.id === hit.source)?.cardId,
      'steward',
    );
});
test('Second Steward never farms the only same target, and dead Air recipients are reselected', () => {
  const h = harness(),
    s = h.unit('captain-jigga'),
    enemy = h.unit('enemy', 0, 2, 'opponent');
  specialsEntrance(h.ctx, s);
  assert.equal(enemy.hands, 0);
  assert.equal(h.hits.length, 1);
  assert.equal(h.state.units.filter((u) => u.cardId === 'steward').length, 2);
});
test('Jigga targets the boardwide strongest two and Ashlee chooses her weakest lane after settled buffs', () => {
  const h = harness(),
    s = h.unit('captain-jigga'),
    local = h.unit('local', 0, 3, 'opponent'),
    remote = h.unit('remote', 2, 10, 'opponent'),
    second = h.unit('second', 1, 9, 'opponent');
  specialsEntrance(h.ctx, s);
  assert.equal(remote.hands, 8);
  assert.equal(second.hands, 7);
  assert.equal(local.hands, 3);
  const e = harness(),
    ashlee = e.unit('ashlee', 0, 3);
  e.unit('ally1', 0, 1);
  e.unit('ally2', 0, 1);
  e.unit('left', 1, 6);
  e.unit('right', 2, 6);
  specialsEntrance(e.ctx, ashlee);
  assert.equal(e.state.units.find((u) => u.cardId === 'guyana')?.lane, 1);
});
test('Lawless sends weakest local enemy to its strongest legal other lane and rewards only actual movement', () => {
  const h = harness(),
    s = h.unit('lawless-yn', 0, 2),
    target = h.unit('target', 0, 1, 'opponent');
  h.unit('remote', 2, 9, 'opponent');
  assert.equal(specialsEntrance(h.ctx, s), true);
  assert.equal(target.lane, 2);
  assert.equal(s.hands, 3);
  const e = harness(),
    actor = e.unit('lawless-yn', 0, 2),
    guarded = e.unit('guarded', 0, 1, 'opponent');
  guarded.protected = true;
  assert.equal(specialsEntrance(e.ctx, actor), false);
  assert.equal(guarded.lane, 0);
  assert.equal(actor.hands, 2);
});
test('Lawless does not skip frozen weakest target and movement Lock prevents reward', () => {
  const h = harness(),
    s = h.unit('lawless-yn', 0, 2),
    locked = h.unit('locked', 0, 1, 'opponent'),
    other = h.unit('other', 0, 4, 'opponent');
  locked.frozen = true;
  assert.equal(specialsEntrance(h.ctx, s), false);
  assert.equal(other.lane, 0);
  assert.equal(s.hands, 2);
  locked.frozen = false;
  locked.movementLocks = [{ sourceId: 'lock', expiresAt: 10000 }];
  assert.equal(specialsEntrance(h.ctx, s), false);
});
test('LeBron fully cleanses and Protects then personal enemy shield break retaliates once while active', () => {
  const h = harness(),
    s = h.unit('lebron-james', 0, 4),
    target = h.unit('ally', 0, 1),
    attacker = h.unit('enemy', 0, 9, 'opponent');
  target.frozen = true;
  target.burnStacks = 2;
  target.movementLocks = [{ sourceId: 'x', expiresAt: 10000 }];
  assert.equal(specialsEntrance(h.ctx, s), true);
  assert.equal(target.frozen, false);
  assert.equal(target.burnStacks, 0);
  assert.deepEqual(target.movementLocks, []);
  assert.equal(h.ctx.damage(attacker, target, 2), 0);
  assert.equal(attacker.hands, 6);
  assert.equal(target.hands, 1);
  target.protected = true;
  h.ctx.damage(attacker, target, 2);
  assert.equal(attacker.hands, 6);
});
test('LeBron ignores district shields, friendly hits and disabled or absent casters', () => {
  const h = harness(),
    s = h.unit('lebron-james'),
    target = h.unit('ally', 0, 1),
    attacker = h.unit('enemy', 0, 9, 'opponent');
  specialsEntrance(h.ctx, s);
  specialsProtectionConsumed(h.ctx, target, attacker, false);
  assert.equal(attacker.hands, 9);
  specialsProtectionConsumed(h.ctx, target, s, true);
  assert.equal(s.hands, 4);
  s.silenced = true;
  specialsProtectionConsumed(h.ctx, target, attacker, true);
  assert.equal(attacker.hands, 9);
});
test('Oz prioritizes latest successful live traveler over a newer ordinary character and adds traveler2', () => {
  const h = harness(),
    traveler = h.unit('lion', 0, 2);
  h.entrance(traveler, true);
  const recent = h.unit('edgar');
  h.entrance(recent, true);
  const s = h.unit('oz');
  assert.equal(specialsEntrance(h.ctx, s), true);
  assert.equal(h.repeats[0].actor, traveler.id);
  assert.equal(h.repeats[0].cardId, 'lion');
  assert.equal(traveler.hands, 4);
  assert.equal(recent.hands, 4);
  assert.equal(specialsEntrance(h.ctx, s), false);
});
test('Oz can replay an earlier-pulse survivor, moved bonus3 wins over traveler2, and spent ledger survives redeploy', () => {
  const h = harness(),
    traveler = h.unit('dorothy', 0, 2);
  h.entrance(traveler, true);
  h.state.elapsedMs = 30000;
  specialsMoved(h.ctx, traveler);
  const s = h.unit('oz');
  specialsEntrance(h.ctx, s);
  assert.equal(traveler.hands, 5);
  h.state.units = h.state.units.filter((u) => u.id !== s.id);
  assert.equal(specialsEntrance(h.ctx, h.unit('oz')), false);
});
test('Oz excludes failed, dead, inactive and persistent entrances, with no candidate keeping its charge', () => {
  const h = harness(),
    failed = h.unit('edgar');
  h.entrance(failed, false);
  const persistent = h.unit('corner-coach');
  h.entrance(persistent, true);
  const dead = h.unit('lion');
  h.entrance(dead, true);
  dead.hands = 0;
  const s = h.unit('oz');
  assert.equal(specialsEntrance(h.ctx, s), false);
  const valid = h.unit('nguyen');
  h.entrance(valid, true);
  assert.equal(specialsEntrance(h.ctx, s), true);
  assert.equal(h.repeats[0].actor, valid.id);
  assert.equal(valid.hands, 4);
});
test('Echoes do not overwrite Tayaty predecessor/history or reset persistent charges', () => {
  const h = harness(),
    a = h.unit('edgar');
  h.entrance(a, true);
  const echo = h.unit('nguyen');
  specialsEntranceResolved(h.ctx, echo, true, { echoed: true });
  assert.equal(h.state.specials?.lastResolved?.cardId, 'edgar');
  assert.equal(h.state.specials?.history.length, 1);
  for (const id of [
    'scammer',
    'bad-lil-cousin-tayaty',
    'corner-coach',
    'lebron-james',
    'oz',
    'inmate-kingpin',
  ])
    assert.equal(
      specialsEntrance(h.ctx, h.unit(id), { echoed: true }),
      false,
      id,
    );
});
test('Cheshire held return leaves actual Grin at old lane, once per pulse, no more than one per lane', () => {
  const h = harness();
  h.state.players.player.hand = ['cheshire'];
  const a = h.unit('a', 1);
  h.returned(a);
  const grin = h.state.units.find((u) => u.cardId === 'grin')!;
  assert.equal(grin.lane, 1);
  assert.equal(grin.hands, 4);
  assert.equal(grin.position, 0);
  assert.equal(grin.sourceUnitId, 'hand:player:cheshire');
  h.returned(h.unit('b', 2));
  assert.equal(h.state.units.filter((u) => u.cardId === 'grin').length, 1);
  h.state.elapsedMs = 10000;
  h.returned(h.unit('c', 1));
  assert.equal(h.state.units.filter((u) => u.cardId === 'grin').length, 1);
  h.state.elapsedMs = 20000;
  h.returned(h.unit('d', 2));
  assert.equal(h.state.units.filter((u) => u.cardId === 'grin').length, 2);
});
test('Cheshire board source may itself return; frozen/silenced sources do not provide Grins', () => {
  const h = harness(),
    cat = h.unit('cheshire', 2);
  h.returned(cat);
  assert.equal(h.state.units.find((u) => u.cardId === 'grin')?.lane, 2);
  for (const status of ['frozen', 'silenced', 'weakened'] as const) {
    const e = harness(),
      disabled = e.unit('cheshire');
    disabled[status] = true;
    e.returned(e.unit('other'));
    assert.equal(
      e.state.units.some((u) => u.cardId === 'grin'),
      false,
      status,
    );
  }
});
test('Rabbit held discounts one next real deployment, read-only quotes do not allocate runtime', () => {
  const h = harness();
  assert.equal(specialsDiscount(h.ctx, 'player', { id: 'x' }), undefined);
  assert.equal(h.state.specials, undefined);
  h.state.players.player.hand = ['mr-rabbit'];
  h.returned(h.unit('edgar'));
  const d = specialsDiscount(h.ctx, 'player', { id: 'edgar' })!;
  assert.equal(d.amount, 1);
  assert.equal(d.minimum, 1);
  assert.equal(d.source.id, 'hand:player:mr-rabbit');
  assert.equal(specialsDiscount(h.ctx, 'opponent', { id: 'edgar' }), undefined);
  specialsSpendDiscount(h.ctx, 'player', d.id);
  assert.equal(specialsDiscount(h.ctx, 'player', { id: 'edgar' }), undefined);
});
test('Rabbit board gains for another character return, never its own; newly returned Rabbit has no retroactive held discount', () => {
  const h = harness(),
    rabbit = h.unit('mr-rabbit', 0, 1);
  h.returned(h.unit('other'));
  assert.equal(rabbit.hands, 2);
  h.returned(rabbit);
  assert.equal(
    specialsDiscount(h.ctx, 'player', { id: 'mr-rabbit' }),
    undefined,
  );
  assert.equal(h.state.specials?.discounts.length, 0);
});
test('Return capture is before mutation, ignores tokens, and does not treat Mary disappearance as return', () => {
  const h = harness();
  h.state.players.player.hand = ['cheshire', 'mr-rabbit'];
  h.returned(h.unit('steward'));
  assert.equal(h.state.specials, undefined);
  const mary = h.unit('ms-mary-mack');
  h.ctx.disappear(mary);
  assert.equal(
    h.state.units.some((u) => u.cardId === 'grin'),
    false,
  );
});
test('Kingpin passes Contraband among3 distinct Inmates then pays each survivor once', () => {
  const h = harness(),
    first = h.unit('inmate-informant', 2, 1),
    s = h.unit('inmate-kingpin');
  specialsEntrance(h.ctx, s);
  assert.equal(first.hands, 2);
  const second = h.unit('inmate-contraband', 1, 2);
  specialsPlayed(h.ctx, second);
  assert.equal(second.hands, 3);
  specialsMoved(h.ctx, second);
  assert.equal(second.hands, 3);
  const third = h.unit('inmate-reformed', 0, 3);
  specialsMoved(h.ctx, third);
  assert.equal(first.hands, 3);
  assert.equal(second.hands, 4);
  assert.equal(third.hands, 5);
  assert.equal(h.state.specials?.stashes.length, 0);
  specialsPlayed(h.ctx, h.unit('inmate-new'));
  assert.equal(first.hands, 3);
});
test('Kingpin can hold pending, ignores himself/non-Inmates/tokens/echoes, retains one match cap after recycle', () => {
  const h = harness(),
    s = h.unit('inmate-kingpin');
  assert.equal(specialsEntrance(h.ctx, s), true);
  assert.equal(s.hands, 4);
  const non = h.unit('not-inmate');
  specialsPlayed(h.ctx, non);
  assert.equal(non.hands, 4);
  const copy = h.unit('inmate-informant');
  specialsPlayed(h.ctx, copy, { echoed: true });
  assert.equal(copy.hands, 4);
  specialsPlayed(h.ctx, copy);
  assert.equal(copy.hands, 5);
  h.state.units = h.state.units.filter((u) => u.id !== s.id);
  assert.equal(specialsEntrance(h.ctx, h.unit('inmate-kingpin')), false);
});
test('Kingpin skips lost carriers at final payout and source need not remain active', () => {
  const h = harness(),
    s = h.unit('inmate-kingpin'),
    first = h.unit('inmate-informant', 0, 1);
  specialsEntrance(h.ctx, s);
  s.hands = 0;
  first.hands = 0;
  const second = h.unit('inmate-contraband', 0, 1);
  specialsPlayed(h.ctx, second);
  const third = h.unit('inmate-reformed', 0, 1);
  specialsMoved(h.ctx, third);
  assert.equal(first.hands, 0);
  assert.equal(second.hands, 3);
  assert.equal(third.hands, 3);
});
test('Mary collects settled census, disappears without a deck return then lands next pulse in weakest lane at home', () => {
  const h = harness(),
    s = h.unit('ms-mary-mack', 0, 3);
  s.hands = 5;
  s.maxHands = 8;
  h.entrance(s);
  for (let i = 0; i < 5; i++) h.unit(`enemy${i}`, 0, 3, 'opponent');
  h.unit('friend', 1, 5);
  h.state.elapsedMs = 10000;
  specialsTick(h.ctx);
  assert.equal(
    h.state.units.some((u) => u.id === s.id),
    false,
  );
  assert.equal(h.state.players.player.returns.length, 0);
  assert.equal(h.state.players.player.hand.length, 0);
  h.state.elapsedMs = 20000;
  specialsTick(h.ctx);
  const elephant = h.state.units.find((u) => u.id === s.id)!;
  assert.equal(elephant.lane, 0);
  assert.equal(elephant.position, 0);
  assert.equal(elephant.baseHands, 4);
  assert.equal(elephant.hands, 6);
  assert.equal(elephant.maxHands, 9);
  assert.equal(elephant.art, SPECIAL_ARTWORK.elephant);
  assert.equal(
    h.state.units
      .filter((u) => u.side === 'opponent')
      .every((u) => u.hands === 2),
    true,
  );
  assert.equal(h.state.specials?.mary[s.id].used, true);
});
test('Mary damage is not silently healed by transformation; once-per-instance transform does not loop', () => {
  const h = harness(),
    s = h.unit('ms-mary-mack', 0, 3);
  s.hands = 1;
  h.entrance(s);
  for (let i = 0; i < 5; i++) h.unit(`enemy${i}`, 0, 4, 'opponent');
  h.state.elapsedMs = 10000;
  specialsTick(h.ctx);
  h.state.elapsedMs = 20000;
  specialsTick(h.ctx);
  assert.equal(h.state.units.find((u) => u.id === s.id)?.hands, 2);
  h.state.elapsedMs = 30000;
  specialsTick(h.ctx);
  assert.equal(
    h.state.units.some((u) => u.id === s.id),
    true,
  );
  assert.equal(h.state.specials?.mary[s.id].pending, undefined);
});
test('Mary simultaneous census is captured once; no income while disabled and Last Stand keeps her on board', () => {
  const h = harness(),
    a = h.unit('ms-mary-mack', 0, 3),
    b = h.unit('ms-mary-mack', 0, 3, 'opponent');
  h.entrance(a);
  h.entrance(b);
  for (let i = 0; i < 4; i++) {
    h.unit(`friend${i}`);
    h.unit(`enemy${i}`, 0, 4, 'opponent');
  }
  h.state.elapsedMs = 10000;
  specialsTick(h.ctx);
  assert.equal(h.state.specials?.mary[a.id].cents, 15);
  assert.equal(h.state.specials?.mary[b.id].cents, 15);
  assert.ok(h.state.specials?.mary[a.id].pending);
  assert.ok(h.state.specials?.mary[b.id].pending);
  const e = harness(),
    mary = e.unit('ms-mary-mack');
  e.entrance(mary);
  e.unit('enemy', 0, 4, 'opponent');
  mary.silenced = true;
  e.state.elapsedMs = 10000;
  specialsTick(e.ctx);
  assert.equal(e.state.specials?.mary[mary.id], undefined);
  mary.silenced = false;
  e.final();
  for (let i = 0; i < 4; i++) e.unit(`more${i}`, 0, 4, 'opponent');
  e.state.elapsedMs = 20000;
  specialsTick(e.ctx);
  assert.equal(e.state.specials?.mary[mary.id].cents, 15);
  assert.equal(e.state.units.includes(mary), true);
});
test('Pending Mary still lands after Last Stand begins, retries a blocked landing, and respects target shields', () => {
  const h = harness(),
    s = h.unit('ms-mary-mack', 0, 3);
  h.entrance(s);
  for (let i = 0; i < 5; i++) h.unit(`enemy${i}`, 0, 3, 'opponent');
  const ward = h.state.units.find((u) => u.side === 'opponent')!;
  ward.protected = true;
  h.state.elapsedMs = 10000;
  specialsTick(h.ctx);
  h.final();
  h.landBlocked(true);
  h.state.elapsedMs = 20000;
  specialsTick(h.ctx);
  assert.ok(h.state.specials?.mary[s.id].pending);
  h.landBlocked(false);
  h.state.elapsedMs = 30000;
  specialsTick(h.ctx);
  assert.equal(h.state.specials?.mary[s.id].pending, undefined);
  assert.equal(ward.hands, 3);
  assert.equal(ward.protected, false);
});
test('Swookie selects strongest Snow, changes combat allegiance and Freeze uses recruited Snow as source', () => {
  const h = harness(),
    s = h.unit('pimp-swookie'),
    weak = h.unit('snow-bunny', 1, 2, 'opponent'),
    strong = h.unit('snow-bunny', 2, 6, 'opponent'),
    victim = h.unit('victim', 2, 8, 'opponent');
  specialsAfterBoardChange(h.ctx);
  assert.equal(strong.side, 'player');
  assert.equal(weak.side, 'opponent');
  assert.equal(victim.frozen, true);
  assert.equal(h.recruits[0].source, s.id);
  assert.equal(h.recruits[0].target, strong.id);
  assert.equal(h.state.specials?.seats.player.recruits, 1);
});
test('Swookie shared pulse limit and2-success match limit survive copies and reentrant board changes', () => {
  const h = harness();
  h.unit('pimp-swookie');
  h.unit('pimp-swookie', 1);
  h.unit('pimp-swookie', 2, 4, 'opponent');
  h.reentrant();
  for (let i = 0; i < 3; i++) h.unit('snow-bunny', i as Lane, 3, 'opponent');
  specialsAfterBoardChange(h.ctx);
  assert.equal(h.recruits.length, 1);
  assert.equal(h.state.specials?.seats.player.recruits, 1);
  assert.equal(h.state.specials?.seats.opponent.recruits, 0);
  specialsAfterBoardChange(h.ctx);
  assert.equal(h.recruits.length, 1);
  h.state.elapsedMs = 10000;
  specialsAfterBoardChange(h.ctx);
  assert.equal(h.recruits.length, 2);
  h.state.elapsedMs = 20000;
  specialsAfterBoardChange(h.ctx);
  assert.equal(h.state.specials?.seats.player.recruits, 2);
  assert.equal(h.recruits.length, 2);
});
test('Blocked recruitment spends attempt but no success; no candidate does not spend and later arrival can trigger', () => {
  const h = harness();
  h.unit('pimp-swookie');
  specialsAfterBoardChange(h.ctx);
  assert.equal(h.state.specials?.seats.player.recruitPulse, -1);
  const snow = h.unit('snow-bunny', 0, 4, 'opponent');
  snow.protected = true;
  specialsAfterBoardChange(h.ctx);
  assert.equal(snow.side, 'opponent');
  assert.equal(snow.protected, false);
  assert.equal(h.state.specials?.seats.player.recruits, 0);
  specialsAfterBoardChange(h.ctx);
  assert.equal(snow.side, 'opponent');
  h.state.elapsedMs = 10000;
  specialsAfterBoardChange(h.ctx);
  assert.equal(snow.side, 'player');
  assert.equal(h.state.specials?.seats.player.recruits, 1);
});
test('Recruitment interception never steals defender; disabled Snow is recruited without Freeze and disabled Pimp cannot recruit', () => {
  const h = harness(),
    s = h.unit('pimp-swookie'),
    snow = h.unit('snow-bunny', 0, 4, 'opponent'),
    interceptor = h.unit('interceptor', 0, 6, 'opponent');
  h.redirect(interceptor);
  specialsAfterBoardChange(h.ctx);
  assert.equal(interceptor.side, 'opponent');
  assert.equal(snow.side, 'opponent');
  assert.equal(h.state.specials?.seats.player.recruits, 0);
  h.redirect();
  h.state.elapsedMs = 10000;
  snow.frozen = true;
  specialsAfterBoardChange(h.ctx);
  assert.equal(snow.side, 'player');
  assert.equal(interceptor.frozen, undefined);
  const e = harness(),
    disabled = e.unit('pimp-swookie'),
    target = e.unit('snow-bunny', 0, 4, 'opponent');
  disabled.weakened = true;
  specialsAfterBoardChange(e.ctx);
  assert.equal(target.side, 'opponent');
  assert.equal(e.state.specials, undefined);
});
test('Already recruited Snow cannot be stolen back by another side; independent side budgets remain distinct', () => {
  const h = harness();
  h.unit('pimp-swookie');
  const snow = h.unit('snow-bunny', 0, 4, 'opponent');
  specialsAfterBoardChange(h.ctx);
  h.unit('pimp-swookie', 1, 4, 'opponent');
  h.state.elapsedMs = 10000;
  specialsAfterBoardChange(h.ctx);
  assert.equal(snow.side, 'player');
  assert.equal(h.state.specials?.seats.opponent.recruits, 0);
});
test('Runtime clone is deep and inactive ticks/quote remain allocation-free', () => {
  const h = harness();
  specialsTick(h.ctx);
  assert.equal(h.state.specials, undefined);
  h.entrance(h.unit('corner-coach'));
  const clone = cloneSpecialsRuntime(h.state.specials)!;
  clone.seats.player.used.x = true;
  clone.history.push({ unitId: 'x', cardId: 'edgar', sequence: 2 });
  assert.equal(h.state.specials?.seats.player.used.x, undefined);
  assert.equal(h.state.specials?.history.length, 0);
});
