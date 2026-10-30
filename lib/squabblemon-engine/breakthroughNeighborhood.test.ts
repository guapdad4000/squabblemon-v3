import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardCatalog } from './src/data';
import type { GameState, Lane, Side, Unit } from './src/breakthrough';
import {
  NEIGHBORHOOD_ADAPTERS,
  NEIGHBORHOOD_ABILITY_DESCRIPTIONS,
  neighborhoodEntrance,
  neighborhoodArrived,
  neighborhoodTick,
  cloneNeighborhoodRuntime,
  type NeighborhoodContext,
  type NeighborhoodDefinition,
} from './src/breakthroughNeighborhood';

function harness() {
  const definitions = new Map<string, NeighborhoodDefinition>(
    cardCatalog.map((c) => [
      c.catalogId,
      {
        id: c.catalogId,
        cost: c.cost,
        kind: c.kind ?? 'character',
        hazard: c.hazard,
        element: c.type,
        ability:
          (NEIGHBORHOOD_ADAPTERS as Record<string, { ability: string }>)[
            c.catalogId
          ]?.ability ?? 'outside',
      },
    ]),
  );
  const seat = () => ({
    motion: 4,
    hand: [],
    queue: [],
    reinforcements: [],
    returns: [],
    breaches: 0,
    squabbleUsed: false,
    nextDrawAt: 3000,
  });
  const state = {
    units: [],
    roster: [],
    elapsedMs: 0,
    events: [],
    nextEventId: 1,
    durationMs: 180000,
    players: { player: seat(), opponent: seat() },
  } as unknown as GameState;
  const blocked = new Set<string>(),
    hits: { target: string; amount: number }[] = [];
  let nextId = 1;
  let onGain: ((u: Unit) => void) | undefined;
  function defense(target: Unit, apply: () => void): boolean {
    if (target.immune) return false;
    if (target.protected) {
      target.protected = false;
      return false;
    }
    apply();
    return true;
  }
  const ctx: NeighborhoodContext = {
    state,
    definition: (u) =>
      definitions.get(u.cardId) ?? {
        id: u.cardId,
        cost: 2,
        kind: 'character',
        element: 'Normal',
        ability: 'outside',
      },
    active: (u) => u.hands > 0 && !u.frozen && !u.silenced && !u.weakened,
    power: (u) => (u.frozen ? 0 : Math.max(0, u.hands)),
    gain(u, n) {
      if (u.hands <= 0) return;
      u.hands += n;
      u.maxHands += n;
      onGain?.(u);
    },
    damage(_source, target, n) {
      let actual = 0;
      defense(target, () => {
        actual = Math.min(n, Math.max(0, target.hands));
        target.hands -= actual;
        target.damageTaken = (target.damageTaken ?? 0) + actual;
      });
      hits.push({ target: target.id, amount: actual });
      return actual;
    },
    weaken: (_source, target) =>
      defense(target, () => {
        target.weakened = true;
      }),
    silence: (_source, target) =>
      defense(target, () => {
        target.silenced = true;
      }),
    protect(_source, target) {
      const added = !target.protected;
      target.protected = true;
      return added;
    },
    cleanse(target, kinds) {
      let changed = false;
      for (const [status, flag] of [
        ['freeze', 'frozen'],
        ['silence', 'silenced'],
        ['weaken', 'weakened'],
      ] as const) {
        if ((!kinds || kinds.includes(status)) && target[flag]) {
          target[flag] = false;
          changed = true;
        }
      }
      if ((!kinds || kinds.includes('burn')) && target.burnStacks) {
        target.burnStacks = 0;
        changed = true;
      }
      if (!kinds && target.movementLocks?.length) {
        target.movementLocks = [];
        changed = true;
      }
      return changed;
    },
    burn: (_source, target, n) =>
      defense(target, () => {
        target.burnStacks = (target.burnStacks ?? 0) + n;
      }),
    openForMove: (u, lane) =>
      !u.frozen &&
      !blocked.has(`${u.id}:${lane}`) &&
      !(u.movementLocks ?? []).some((m) => m.expiresAt > state.elapsedMs),
    move(u, lane) {
      if (u.lane === lane || !ctx.openForMove(u, lane)) return false;
      u.lane = lane;
      neighborhoodArrived(ctx, u, { moved: true });
      return true;
    },
    refund(side, n) {
      const before = state.players[side].motion;
      state.players[side].motion = Math.min(9, before + n);
      return state.players[side].motion - before;
    },
    canLoseHands: (u) => !u.immune,
    event: (e) => {
      state.events.push({ ...e, id: state.nextEventId++ });
    },
  };
  function unit(
    cardId: string,
    lane: Lane = 0,
    hands = 4,
    side: Side = 'player',
  ): Unit {
    const u: Unit = {
      id: `u${nextId++}`,
      cardId,
      side,
      lane,
      hands,
      baseHands: hands,
      maxHands: hands,
      position: side === 'player' ? 0.2 : 0.8,
      squabbled: false,
      nextEffectAt: 5000,
    };
    state.units.push(u);
    return u;
  }
  function custom(id: string, patch: Partial<NeighborhoodDefinition>) {
    definitions.set(id, {
      id,
      cost: 2,
      kind: 'character',
      element: 'Normal',
      ...patch,
    });
  }
  return {
    ctx,
    state,
    unit,
    definitions,
    custom,
    blocked,
    hits,
    gainHook(fn: (u: Unit) => void) {
      onGain = fn;
    },
  };
}

test('35 unique explicit adapters refer to final canonical fighters and complete descriptions', () => {
  assert.equal(Object.keys(NEIGHBORHOOD_ADAPTERS).length, 35);
  assert.equal(
    new Set(Object.values(NEIGHBORHOOD_ADAPTERS).map((a) => a.ability)).size,
    35,
  );
  for (const [id, adapter] of Object.entries(NEIGHBORHOOD_ADAPTERS)) {
    const canonical = cardCatalog.find((c) => c.catalogId === id);
    assert.ok(canonical, id);
    assert.equal(canonical.kind ?? 'character', 'character');
    assert.ok(
      NEIGHBORHOOD_ABILITY_DESCRIPTIONS[adapter.ability].length > 30,
      id,
    );
  }
});

test('Grounded uses effective weakest Hands, excludes self and cannot affect remote cards', () => {
  const h = harness(),
    source = h.unit('earthy-sugar-foot'),
    frozen = h.unit('ordinary', 0, 8),
    other = h.unit('ordinary', 0, 2),
    remote = h.unit('ordinary', 1, 1);
  frozen.frozen = true;
  assert.equal(neighborhoodEntrance(h.ctx, source), true);
  assert.deepEqual(
    [source.hands, frozen.hands, other.hands, remote.hands],
    [4, 9, 2, 1],
  );
});

test('Bodega counts other combat cards, but support actions and hazards do not occupy a lane', () => {
  const h = harness(),
    cat = h.unit('bodega-cat');
  assert.equal(neighborhoodEntrance(h.ctx, cat), true);
  assert.equal(cat.hands, 5);
  h.custom('token', { kind: 'token' });
  h.unit('token');
  assert.equal(neighborhoodEntrance(h.ctx, cat), false);
  const e = harness(),
    solo = e.unit('bodega-cat');
  e.custom('hazard', { kind: 'token', hazard: true });
  e.unit('hazard');
  e.unit('soul-food');
  assert.equal(neighborhoodEntrance(e.ctx, solo), true);
});

test('Dog Walker requires two other characters; tokens cannot satisfy Walk the Pack', () => {
  const h = harness(),
    dog = h.unit('dog-walker');
  h.unit('ordinary');
  h.custom('token', { kind: 'token' });
  h.unit('token');
  assert.equal(neighborhoodEntrance(h.ctx, dog), false);
  h.unit('ordinary');
  assert.equal(neighborhoodEntrance(h.ctx, dog), true);
  assert.equal(dog.hands, 7);
});

test('Car Meet moves to the weakest legal lane before helping its weakest other ally', () => {
  const h = harness(),
    car = h.unit('car-meet-kid'),
    low = h.unit('ordinary', 1, 1),
    high = h.unit('ordinary', 2, 8);
  assert.equal(neighborhoodEntrance(h.ctx, car), true);
  assert.equal(car.lane, 1);
  assert.equal(low.hands, 2);
  assert.equal(high.hands, 8);
  const e = harness(),
    parked = e.unit('car-meet-kid'),
    ally = e.unit('ordinary');
  e.blocked.add(`${parked.id}:1`);
  e.blocked.add(`${parked.id}:2`);
  assert.equal(neighborhoodEntrance(e.ctx, parked), false);
  assert.equal(ally.hands, 4);
});

test('Drop Off ignores zero/expensive cards and selects a legal passenger before choosing weakest', () => {
  const h = harness(),
    delivery = h.unit('delivery-demon'),
    frozen = h.unit('ordinary', 0, 1),
    passenger = h.unit('ordinary', 0, 3);
  frozen.frozen = true;
  h.custom('zero', { cost: 0 });
  const zero = h.unit('zero', 0, 1);
  h.custom('costly', { cost: 4 });
  const costly = h.unit('costly', 0, 1);
  assert.equal(neighborhoodEntrance(h.ctx, delivery), true);
  assert.equal(passenger.lane, 1);
  assert.equal(frozen.lane, 0);
  assert.equal(zero.lane, 0);
  assert.equal(costly.lane, 0);
});

test('Subway Magician still moves when its status is blocked; total failure grants no invented success', () => {
  const h = harness(),
    magician = h.unit('subway-magician'),
    enemy = h.unit('enemy', 0, 5, 'opponent');
  enemy.protected = true;
  assert.equal(neighborhoodEntrance(h.ctx, magician), true);
  assert.equal(magician.lane, 1);
  assert.equal(enemy.weakened, undefined);
  const e = harness(),
    stuck = e.unit('subway-magician'),
    shielded = e.unit('enemy', 0, 5, 'opponent');
  shielded.immune = true;
  e.blocked.add(`${stuck.id}:1`);
  e.blocked.add(`${stuck.id}:2`);
  assert.equal(neighborhoodEntrance(e.ctx, stuck), false);
});

test('OG Dominican gains two only after its legal arrival', () => {
  const h = harness(),
    og = h.unit('og-dominican');
  assert.equal(neighborhoodEntrance(h.ctx, og), true);
  assert.equal(og.hands, 6);
  assert.equal(og.lane, 1);
  const e = harness(),
    stuck = e.unit('og-dominican');
  e.blocked.add(`${stuck.id}:1`);
  e.blocked.add(`${stuck.id}:2`);
  assert.equal(neighborhoodEntrance(e.ctx, stuck), false);
  assert.equal(stuck.hands, 4);
});

test('Conductor selects a movable passenger, then fully cleanses and gives Water its extra Hand', () => {
  const h = harness(),
    conductor = h.unit('last-train-conductor'),
    frozen = h.unit('ordinary', 0, 1),
    passenger = h.unit('stillwater-medic', 0, 3);
  frozen.frozen = true;
  passenger.silenced = true;
  passenger.weakened = true;
  passenger.burnStacks = 2;
  assert.equal(neighborhoodEntrance(h.ctx, conductor), true);
  assert.equal(passenger.lane, 1);
  assert.equal(passenger.hands, 6);
  assert.equal(passenger.silenced, false);
  assert.equal(passenger.weakened, false);
  assert.equal(passenger.burnStacks, 0);
  assert.equal(frozen.frozen, true);
});

test('Fein gains against one enemy and Burns only with at least two; blocked Burn does not erase the self gain', () => {
  const h = harness(),
    fein = h.unit('fein');
  assert.equal(neighborhoodEntrance(h.ctx, fein), false);
  const low = h.unit('enemy', 0, 2, 'opponent');
  assert.equal(neighborhoodEntrance(h.ctx, fein), true);
  assert.equal(fein.hands, 5);
  assert.equal(low.burnStacks, undefined);
  const high = h.unit('enemy', 0, 6, 'opponent');
  high.protected = true;
  neighborhoodEntrance(h.ctx, fein);
  assert.equal(fein.hands, 6);
  assert.equal(high.burnStacks, undefined);
  neighborhoodEntrance(h.ctx, fein);
  assert.equal(high.burnStacks, 1);
});

test('Stoner Jr selects Freeze/Silence patients and fully cleanses without inventing a healthy payoff', () => {
  const h = harness(),
    jr = h.unit('stoner-jr'),
    patient = h.unit('ordinary', 0, 9),
    healthy = h.unit('ordinary', 0, 1);
  patient.frozen = true;
  patient.burnStacks = 3;
  patient.weakened = true;
  assert.equal(neighborhoodEntrance(h.ctx, jr), true);
  assert.equal(patient.hands, 10);
  assert.equal(patient.frozen, false);
  assert.equal(patient.burnStacks, 0);
  assert.equal(patient.weakened, false);
  assert.equal(healthy.hands, 1);
  assert.equal(neighborhoodEntrance(h.ctx, jr), false);
});

test('Krump preserves its self gain when enemy Protection blocks the hit', () => {
  const h = harness(),
    krump = h.unit('krump-dancer'),
    enemy = h.unit('enemy', 0, 5, 'opponent');
  enemy.protected = true;
  assert.equal(neighborhoodEntrance(h.ctx, krump), true);
  assert.equal(krump.hands, 6);
  assert.equal(enemy.hands, 5);
});

test('Side Hustle needs a remote real character and an actual refund below the cap', () => {
  const h = harness(),
    source = h.unit('yung-hustle');
  h.custom('token', { kind: 'token' });
  h.unit('token', 1);
  assert.equal(neighborhoodEntrance(h.ctx, source), false);
  h.unit('ordinary', 2);
  assert.equal(neighborhoodEntrance(h.ctx, source), true);
  assert.equal(h.state.players.player.motion, 5);
  h.state.players.player.motion = 9;
  assert.equal(neighborhoodEntrance(h.ctx, source), false);
});

test('Red Pill branches from Weaken to Silence, rewarding only a landed hostile package', () => {
  const h = harness(),
    pill = h.unit('red-pill'),
    enemy = h.unit('enemy', 0, 6, 'opponent');
  assert.equal(neighborhoodEntrance(h.ctx, pill), true);
  assert.equal(enemy.weakened, true);
  assert.equal(pill.hands, 4);
  enemy.protected = true;
  assert.equal(neighborhoodEntrance(h.ctx, pill), false);
  assert.equal(pill.hands, 4);
  assert.equal(neighborhoodEntrance(h.ctx, pill), true);
  assert.equal(enemy.silenced, true);
  assert.equal(pill.hands, 6);
});

test('Simmy supports its ally even if the enemy damage package is blocked', () => {
  const h = harness(),
    simmy = h.unit('simmy'),
    ally = h.unit('ordinary', 0, 2),
    enemy = h.unit('enemy', 0, 8, 'opponent');
  enemy.protected = true;
  assert.equal(neighborhoodEntrance(h.ctx, simmy), true);
  assert.equal(ally.hands, 4);
  assert.equal(enemy.hands, 8);
});

test('Tron pays one Motion only when all three real characters actually gained Hands', () => {
  const h = harness(),
    tron = h.unit('tron');
  const a = h.unit('ordinary', 0, 1),
    b = h.unit('ordinary', 0, 2),
    c = h.unit('ordinary', 0, 3);
  h.custom('token', { kind: 'token' });
  const token = h.unit('token', 0, 1);
  assert.equal(neighborhoodEntrance(h.ctx, tron), true);
  assert.deepEqual([a.hands, b.hands, c.hands, token.hands], [2, 3, 4, 1]);
  assert.equal(h.state.players.player.motion, 5);
  const e = harness(),
    source = e.unit('tron'),
    first = e.unit('ordinary', 0, 1),
    second = e.unit('ordinary', 0, 2);
  e.unit('ordinary', 0, 3);
  e.gainHook((u) => {
    if (u.id === first.id)
      e.state.units = e.state.units.filter((v) => v.id !== second.id);
  });
  assert.equal(neighborhoodEntrance(e.ctx, source), true);
  assert.equal(e.state.players.player.motion, 4);
});

test('Sugarfoot cannot farm a protected already-Weakened target', () => {
  const h = harness(),
    source = h.unit('sugarfoot'),
    enemy = h.unit('enemy', 0, 5, 'opponent');
  enemy.weakened = true;
  enemy.protected = true;
  assert.equal(neighborhoodEntrance(h.ctx, source), false);
  assert.equal(source.hands, 4);
  assert.equal(neighborhoodEntrance(h.ctx, source), true);
  assert.equal(source.hands, 5);
});

test('Riptide only gains when damage lands, never on immunity, a consumed shield or overkill fiction', () => {
  for (const defense of ['immune', 'protected', 'none'] as const) {
    const h = harness(),
      source = h.unit('riptide-bruiser'),
      enemy = h.unit('enemy', 0, 1, 'opponent');
    if (defense !== 'none') enemy[defense] = true;
    assert.equal(neighborhoodEntrance(h.ctx, source), defense === 'none');
    assert.equal(source.hands, defense === 'none' ? 5 : 4);
    assert.equal(enemy.hands, defense === 'none' ? 0 : 1);
  }
});

test('Stillwater gains only when its selected Freeze/Silence patient is actually cleansed', () => {
  const h = harness(),
    medic = h.unit('stillwater-medic'),
    patient = h.unit('ordinary');
  patient.silenced = true;
  patient.burnStacks = 2;
  assert.equal(neighborhoodEntrance(h.ctx, medic), true);
  assert.equal(patient.hands, 5);
  assert.equal(medic.hands, 5);
  assert.equal(patient.burnStacks, 0);
  assert.equal(neighborhoodEntrance(h.ctx, medic), false);
});

test('Sprout requires another Plant ally and grants both printed benefits', () => {
  const h = harness(),
    sprout = h.unit('sprout');
  h.unit('ordinary');
  assert.equal(neighborhoodEntrance(h.ctx, sprout), false);
  const plant = h.unit('earthy-sugar-foot');
  assert.equal(neighborhoodEntrance(h.ctx, sprout), true);
  assert.equal(plant.hands, 6);
  assert.equal(sprout.hands, 5);
});

test('Root Nurse follows post-payment Motion, remote patient, remote Plant, and solo fallback branches', () => {
  const high = harness(),
    nurse = high.unit('root-nurse'),
    frozen = high.unit('ordinary', 1);
  frozen.frozen = true;
  assert.equal(neighborhoodEntrance(high.ctx, nurse), true);
  assert.equal(nurse.hands, 6);
  assert.equal(frozen.frozen, true);
  for (const mode of ['patient', 'plant', 'solo'] as const) {
    const h = harness(),
      source = h.unit('root-nurse');
    h.state.players.player.motion = 3;
    const target =
      mode === 'patient'
        ? h.unit('ordinary', 2)
        : mode === 'plant'
          ? h.unit('earthy-sugar-foot', 1)
          : undefined;
    if (target && mode === 'patient') {
      target.frozen = true;
      target.burnStacks = 2;
    }
    assert.equal(neighborhoodEntrance(h.ctx, source), true);
    assert.equal(source.hands, target ? 4 : 6);
    if (target) {
      assert.equal(target.hands, 7);
      assert.equal(!!target.frozen, false);
      assert.equal(target.burnStacks ?? 0, 0);
    }
  }
});

test('Garden Wall independently pressures remotely and rewards local plus remote Plant allies', () => {
  const h = harness(),
    wall = h.unit('garden-wall'),
    local = h.unit('ordinary', 0, 1),
    remote = h.unit('earthy-sugar-foot', 1, 2),
    enemy = h.unit('enemy', 2, 8, 'opponent');
  enemy.protected = true;
  assert.equal(neighborhoodEntrance(h.ctx, wall), true);
  assert.equal(enemy.hands, 8);
  assert.equal(local.hands, 2);
  assert.equal(remote.hands, 3);
});

test('Gust hits only after moving and selects effective weakest at destination', () => {
  const h = harness(),
    gust = h.unit('gust'),
    low = h.unit('enemy', 1, 2, 'opponent'),
    high = h.unit('enemy', 1, 9, 'opponent');
  assert.equal(neighborhoodEntrance(h.ctx, gust), true);
  assert.equal(gust.lane, 1);
  assert.equal(low.hands, 1);
  assert.equal(high.hands, 9);
  const e = harness(),
    stuck = e.unit('gust'),
    enemy = e.unit('enemy', 1, 2, 'opponent');
  e.blocked.add(`${stuck.id}:1`);
  e.blocked.add(`${stuck.id}:2`);
  assert.equal(neighborhoodEntrance(e.ctx, stuck), false);
  assert.equal(enemy.hands, 2);
});

test('Crosswind can move a legal ally after blocked Weaken and never rewards a failed move', () => {
  const h = harness(),
    wind = h.unit('crosswind'),
    frozen = h.unit('ordinary', 0, 1),
    traveler = h.unit('ordinary', 0, 2),
    enemy = h.unit('enemy', 0, 5, 'opponent');
  frozen.frozen = true;
  enemy.immune = true;
  assert.equal(neighborhoodEntrance(h.ctx, wind), true);
  assert.equal(traveler.lane, 1);
  assert.equal(traveler.hands, 4);
  assert.equal(frozen.lane, 0);
});

test('Cloudbreak protects the correct ally in its old lane and failed movement pays nothing', () => {
  const h = harness(),
    source = h.unit('cloudbreak'),
    air = h.unit('gust', 0, 1),
    remote = h.unit('ordinary', 1, 5);
  assert.equal(neighborhoodEntrance(h.ctx, source), true);
  assert.equal(source.lane, 2);
  assert.equal(source.hands, 5);
  assert.equal(air.hands, 4);
  assert.equal(air.protected, true);
  assert.equal(remote.hands, 5);
  const e = harness(),
    stuck = e.unit('cloudbreak'),
    ally = e.unit('ordinary');
  e.blocked.add(`${stuck.id}:1`);
  e.blocked.add(`${stuck.id}:2`);
  assert.equal(neighborhoodEntrance(e.ctx, stuck), false);
  assert.equal(ally.hands, 4);
  assert.equal(ally.protected, undefined);
});

test('Bad Omen and Quiet Tip use normal defenses and actual outcomes', () => {
  for (const id of ['red-side-4', 'inmate-informant']) {
    const h = harness(),
      source = h.unit(id),
      enemy = h.unit('enemy', 0, 5, 'opponent');
    enemy.protected = true;
    assert.equal(neighborhoodEntrance(h.ctx, source), false);
    assert.equal(enemy.hands, 5);
    assert.equal(enemy.weakened, undefined);
    assert.equal(neighborhoodEntrance(h.ctx, source), true);
    if (id === 'red-side-4') assert.equal(enemy.weakened, true);
    else assert.equal(enemy.hands, 2);
  }
});

test('Miami Surgeon boosts a healthy ally but Redneck cannot invent a healthy cleanse', () => {
  for (const id of ['miami-surgeon', 'redneck']) {
    const h = harness(),
      source = h.unit(id),
      patient = h.unit('ordinary');
    assert.equal(neighborhoodEntrance(h.ctx, source), id === 'miami-surgeon');
    assert.equal(patient.hands, id === 'miami-surgeon' ? 6 : 4);
    patient.frozen = true;
    patient.burnStacks = 3;
    patient.movementLocks = [{ sourceId: 'contract', expiresAt: 20000 }];
    assert.equal(neighborhoodEntrance(h.ctx, source), true);
    assert.equal(patient.frozen, false);
    assert.equal(patient.burnStacks, 0);
    assert.deepEqual(patient.movementLocks, []);
  }
});

test('Roommate counts a friendly combat token, while Raid the Chat counts real cheap characters only', () => {
  const h = harness(),
    roommate = h.unit('roommate');
  h.custom('token', { kind: 'token', cost: 0 });
  h.unit('token');
  assert.equal(neighborhoodEntrance(h.ctx, roommate), true);
  assert.equal(roommate.hands, 5);
  const source = h.unit('live-streamer-male');
  h.unit('soul-food');
  h.custom('costly', { cost: 6 });
  h.unit('costly');
  const before = source.hands;
  assert.equal(neighborhoodEntrance(h.ctx, source), true);
  assert.equal(source.hands, before + 1);
  h.unit('ordinary');
  neighborhoodEntrance(h.ctx, source);
  assert.equal(source.hands, before + 3);
});

test('Hidden Stash requires a real ally and never refunds over the cap', () => {
  const h = harness(),
    source = h.unit('inmate-contraband');
  h.custom('token', { kind: 'token' });
  h.unit('token');
  assert.equal(neighborhoodEntrance(h.ctx, source), false);
  h.unit('ordinary');
  assert.equal(neighborhoodEntrance(h.ctx, source), true);
  assert.equal(h.state.players.player.motion, 5);
  h.state.players.player.motion = 9;
  assert.equal(neighborhoodEntrance(h.ctx, source), false);
});

test('Snitch switches to Weaken only when its target was already Silenced', () => {
  const h = harness(),
    source = h.unit('snitch'),
    enemy = h.unit('enemy', 0, 5, 'opponent');
  neighborhoodEntrance(h.ctx, source);
  assert.equal(enemy.silenced, true);
  assert.equal(enemy.weakened, undefined);
  enemy.protected = true;
  assert.equal(neighborhoodEntrance(h.ctx, source), false);
  assert.equal(enemy.weakened, undefined);
  assert.equal(neighborhoodEntrance(h.ctx, source), true);
  assert.equal(enemy.weakened, true);
});

test('Red Ganger skips enemies who cannot lose Hands and never earns a blocked-hit reward', () => {
  const h = harness(),
    source = h.unit('ganger-red'),
    immune = h.unit('enemy', 0, 12, 'opponent'),
    legal = h.unit('enemy', 0, 5, 'opponent');
  immune.immune = true;
  legal.protected = true;
  assert.equal(neighborhoodEntrance(h.ctx, source), false);
  assert.equal(source.hands, 4);
  assert.equal(neighborhoodEntrance(h.ctx, source), true);
  assert.equal(source.hands, 5);
  assert.equal(legal.hands, 3);
  assert.equal(immune.hands, 12);
});

test('welcome uses the weakest other lane and only a genuine friendly Air-character arrival consumes it', () => {
  const h = harness(),
    source = h.unit('honest-thot');
  const frozen = h.unit('ordinary', 1, 10);
  frozen.frozen = true;
  h.unit('ordinary', 2, 1);
  neighborhoodEntrance(h.ctx, source);
  assert.equal(h.state.neighborhood?.marks[0].lane, 1);
  const wrong = h.unit('ordinary', 1),
    enemy = h.unit('gust', 1, 4, 'opponent'),
    air = h.unit('gust', 1);
  neighborhoodArrived(h.ctx, wrong);
  neighborhoodArrived(h.ctx, enemy);
  neighborhoodArrived(h.ctx, air, { echoed: true });
  assert.equal(air.hands, 4);
  h.state.units = h.state.units.filter((u) => u.id !== source.id); // authored reveal mark persists without its source
  neighborhoodArrived(h.ctx, air);
  assert.equal(air.hands, 6);
  assert.equal(h.state.neighborhood?.marks.length, 0);
  neighborhoodArrived(h.ctx, air);
  assert.equal(air.hands, 6);
});

test('paint ignores same-element allies and tokens, recognizes Rock as Earth, and consumes before gain callbacks', () => {
  const h = harness(),
    source = h.unit('mural-apprentice');
  h.definitions.get(source.cardId)!.element = 'Rock';
  neighborhoodEntrance(h.ctx, source);
  h.custom('earth', { element: 'Earth' });
  const same = h.unit('earth');
  h.custom('token', { kind: 'token', element: 'Air' });
  const token = h.unit('token');
  neighborhoodArrived(h.ctx, same);
  neighborhoodArrived(h.ctx, token);
  assert.equal(h.state.neighborhood?.marks.length, 1);
  const different = h.unit('gust');
  h.gainHook((u) => neighborhoodArrived(h.ctx, u));
  neighborhoodArrived(h.ctx, different);
  assert.equal(different.hands, 6);
  assert.equal(h.state.neighborhood?.marks.length, 0);
});

test('finite marks expire exactly, replace only their authored scope, and remain available in Last Stand', () => {
  const h = harness();
  h.state.elapsedMs = 150000;
  const paint = h.unit('mural-apprentice'),
    second = h.unit('mural-apprentice', 1),
    welcome = h.unit('honest-thot');
  neighborhoodEntrance(h.ctx, paint);
  neighborhoodEntrance(h.ctx, second);
  neighborhoodEntrance(h.ctx, welcome);
  assert.equal(h.state.neighborhood?.marks.length, 3);
  neighborhoodEntrance(h.ctx, paint);
  assert.equal(h.state.neighborhood?.marks.length, 3);
  h.state.elapsedMs = 169999;
  const air = h.unit('gust');
  neighborhoodArrived(h.ctx, air);
  assert.equal(air.hands, 6);
  h.state.elapsedMs = 170000;
  neighborhoodTick(h.ctx);
  assert.equal(h.state.neighborhood?.marks.length, 0);
});

test('clone independence, unsupported-kit rejection and inactive-query behavior preserve original state', () => {
  const h = harness(),
    outsider = h.unit('ordinary');
  const before = JSON.stringify(h.state);
  assert.equal(neighborhoodEntrance(h.ctx, outsider), null);
  neighborhoodTick(h.ctx);
  assert.equal(JSON.stringify(h.state), before);
  const source = h.unit('honest-thot');
  neighborhoodEntrance(h.ctx, source);
  const clone = cloneNeighborhoodRuntime(h.state.neighborhood)!;
  clone.marks[0].source.hands = 0;
  clone.marks.length = 0;
  assert.equal(h.state.neighborhood?.marks.length, 1);
  assert.equal(h.state.neighborhood?.marks[0].source.hands, 4);
  assert.equal(cloneNeighborhoodRuntime(undefined), undefined);
});

test('every explicit entrance is inert while disabled and repeated deterministic fixtures agree', () => {
  for (const id of Object.keys(NEIGHBORHOOD_ADAPTERS)) {
    const run = () => {
      const h = harness(),
        source = h.unit(id);
      h.unit('earthy-sugar-foot');
      h.unit('ordinary');
      h.unit('enemy', 0, 9, 'opponent');
      h.unit('enemy', 1, 5, 'opponent');
      source.silenced = true;
      const before = JSON.stringify(h.state);
      assert.equal(neighborhoodEntrance(h.ctx, source), false, id);
      assert.equal(JSON.stringify(h.state), before, id);
      source.silenced = false;
      neighborhoodEntrance(h.ctx, source);
      return JSON.stringify(h.state);
    };
    assert.equal(run(), run(), id);
  }
});

test('synchronous removal of genuine new bonus cannot erase Tron’s three actual gain receipts', () => {
  const h = harness(),
    tron = h.unit('tron');
  h.unit('ordinary');
  h.unit('ordinary');
  h.unit('ordinary');
  h.gainHook((u) => {
    u.hands -= 1;
  });
  assert.equal(neighborhoodEntrance(h.ctx, tron), true);
  assert.equal(h.state.players.player.motion, 5);
});
