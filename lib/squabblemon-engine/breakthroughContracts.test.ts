import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardCatalog } from './src/data';
import type { GameState, Lane, Side, Unit } from './src/breakthrough';
import {
  CONTRACT_ADAPTERS,
  CONTRACT_ABILITY_DESCRIPTIONS,
  contractsEntrance,
  contractsBeforeEntrance,
  contractsPlayed,
  contractsEntranceResolved,
  contractsArrived,
  contractsCaptureMove,
  contractsMoved,
  contractsGained,
  contractsCleansed,
  contractsDamaged,
  contractsHarmfulStatusApplied,
  contractsDestroyed,
  contractsRefunded,
  contractsHasSafeCrossing,
  contractsDiscount,
  contractsSpendDiscount,
  contractsTick,
  cloneContractsRuntime,
  type ContractsContext,
  type ContractDefinition,
} from './src/breakthroughContracts';

function harness() {
  const definitions = new Map<string, ContractDefinition>(
    cardCatalog.map((c) => [
      c.catalogId,
      {
        id: c.catalogId,
        cost: c.cost,
        kind: c.kind ?? 'character',
        element: c.type,
        ability:
          (CONTRACT_ADAPTERS as Record<string, { ability: string }>)[
            c.catalogId
          ]?.ability ?? 'outside',
      },
    ]),
  );
  const seat = () => ({
    motion: 4,
    hand: [] as string[],
    queue: [],
    reinforcements: [],
    breaches: 0,
    squabbleUsed: false,
    returns: [],
    nextDrawAt: 3000,
    returnedHands: {} as Record<string, number>,
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
  const blocked = new Set<string>(),
    returns: { id: string; bonus: number }[] = [];
  let next = 1,
    lockedLastStand = false;
  const alive = (u: Unit) =>
    state.units.some((v) => v.id === u.id && v.hands > 0);
  function defense(target: Unit, apply: () => void): boolean {
    if (target.immune) return false;
    if (target.protected) {
      target.protected = false;
      return false;
    }
    apply();
    return true;
  }
  const ctx: ContractsContext = {
    state,
    definition: (u) =>
      definitions.get(u.cardId) ?? {
        id: u.cardId,
        cost: 2,
        kind: 'character',
        element: 'Normal',
        ability: 'outside',
      },
    active: (u) => alive(u) && !u.frozen && !u.silenced && !u.weakened,
    power: (u) => (u.frozen ? 0 : Math.max(0, u.hands)),
    gain(u, n, copied = false) {
      if (!alive(u) || n <= 0) return;
      u.hands += n;
      u.maxHands += n;
      contractsGained(ctx, u, n, copied);
    },
    damage(source, target, n) {
      let actual = 0;
      defense(target, () => {
        actual = Math.min(n, Math.max(0, target.hands));
        target.hands -= actual;
        target.damageTaken = (target.damageTaken ?? 0) + actual;
      });
      contractsDamaged(ctx, source, target, actual);
      if (target.hands <= 0)
        contractsDestroyed(
          ctx,
          target,
          source.side,
          source.side !== target.side,
        );
      return actual;
    },
    burn(source, target, n) {
      return defense(target, () => {
        const isNew = !target.burnStacks;
        target.burnStacks = (target.burnStacks ?? 0) + n;
        contractsHarmfulStatusApplied(ctx, source, target, isNew);
      });
    },
    weaken(source, target) {
      return defense(target, () => {
        const isNew = !target.weakened;
        target.weakened = true;
        contractsHarmfulStatusApplied(ctx, source, target, isNew);
      });
    },
    protect(_source, target) {
      const added = !target.protected;
      target.protected = true;
      return added;
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
      if (changed) contractsCleansed(ctx, u);
      return changed;
    },
    openForMove(u, lane) {
      return (
        alive(u) &&
        !u.frozen &&
        !blocked.has(`${u.id}:${lane}`) &&
        (!(u.movementLocks ?? []).some((l) => l.expiresAt > state.elapsedMs) ||
          contractsHasSafeCrossing(ctx, u))
      );
    },
    move(u, lane) {
      if (u.lane === lane || !ctx.openForMove(u, lane)) return false;
      const before = contractsCaptureMove(ctx, u);
      u.lane = lane;
      contractsMoved(ctx, u, before);
      return true;
    },
    enemyMove(source, target, lane, afterMoved) {
      let moved = false;
      const passed = defense(target, () => {
        moved = ctx.move(target, lane);
        if (moved) afterMoved?.(target);
      });
      return passed && moved;
    },
    swap(a, b) {
      if (!ctx.openForMove(a, b.lane) || !ctx.openForMove(b, a.lane))
        return false;
      const beforeA = contractsCaptureMove(ctx, a),
        beforeB = contractsCaptureMove(ctx, b),
        lane = a.lane;
      a.lane = b.lane;
      b.lane = lane;
      contractsMoved(ctx, a, beforeA);
      contractsMoved(ctx, b, beforeB);
      return true;
    },
    canReturn: (u) =>
      alive(u) &&
      !u.frozen &&
      !(u.movementLocks ?? []).some((l) => l.expiresAt > state.elapsedMs) &&
      state.players[u.side].hand.length < 4,
    returnToHand(_source, u, options) {
      if (!ctx.canReturn(u)) return false;
      state.players[u.side].hand.push(u.cardId);
      state.players[u.side].returnedHands![u.cardId] =
        u.hands + options.bonusHands;
      state.units = state.units.filter((v) => v.id !== u.id);
      returns.push({ id: u.id, bonus: options.bonusHands });
      return true;
    },
    removeBonus(u, n) {
      const actual = Math.min(n, Math.max(0, u.hands - u.baseHands));
      u.hands -= actual;
      u.maxHands = Math.max(u.hands, u.maxHands - actual);
      return actual;
    },
    refund(side, n) {
      const p = state.players[side],
        before = p.motion;
      p.motion = Math.min(9, p.motion + n);
      const actual = p.motion - before;
      contractsRefunded(ctx, side, actual);
      return p.motion - before;
    },
    lastStand: () =>
      lockedLastStand || state.elapsedMs >= state.durationMs - 30000,
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
      id: `u${next++}`,
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
  function custom(id: string, patch: Partial<ContractDefinition>) {
    definitions.set(id, {
      id,
      cost: 2,
      kind: 'character',
      element: 'Normal',
      ...patch,
    });
  }
  function deploy(u: Unit) {
    contractsBeforeEntrance(ctx, u);
    u.entranceSucceeded = contractsEntrance(ctx, u) === true;
    contractsPlayed(ctx, u);
    contractsEntranceResolved(ctx, u);
    contractsArrived(ctx, u);
  }
  return {
    ctx,
    state,
    unit,
    custom,
    definitions,
    blocked,
    returns,
    deploy,
    lastStand() {
      lockedLastStand = true;
    },
  };
}

test('35 complete explicit contract adapters retain canonical character identities', () => {
  assert.equal(Object.keys(CONTRACT_ADAPTERS).length, 35);
  assert.equal(
    new Set(Object.values(CONTRACT_ADAPTERS).map((a) => a.ability)).size,
    35,
  );
  for (const [id, a] of Object.entries(CONTRACT_ADAPTERS)) {
    assert.ok(
      cardCatalog.some((c) => c.catalogId === id),
      id,
    );
    assert.ok(CONTRACT_ABILITY_DESCRIPTIONS[a.ability].length > 35, id);
  }
});
test('Ice Cream serves each lane once, auto-routes only legally, and never farms repeated visits', () => {
  const h = harness(),
    truck = h.unit('ice-cream-truck'),
    here = h.unit('ordinary'),
    next = h.unit('ordinary', 1),
    last = h.unit('ordinary', 2);
  assert.equal(contractsEntrance(h.ctx, truck), true);
  assert.equal(here.hands, 6);
  h.state.elapsedMs = 10000;
  contractsTick(h.ctx);
  assert.equal(truck.lane, 1);
  assert.equal(next.hands, 6);
  h.state.elapsedMs = 20000;
  contractsTick(h.ctx);
  assert.equal(truck.lane, 2);
  assert.equal(last.hands, 6);
  h.state.elapsedMs = 30000;
  contractsTick(h.ctx);
  assert.equal(truck.lane, 2);
  h.ctx.move(truck, 0);
  assert.equal(here.hands, 6);
});
test('Truck alone leaves a persistent Treat; blocked routing grants no second Treat', () => {
  const h = harness(),
    truck = h.unit('ice-cream-truck');
  contractsEntrance(h.ctx, truck);
  h.blocked.add(`${truck.id}:1`);
  h.blocked.add(`${truck.id}:2`);
  h.state.elapsedMs = 10000;
  contractsTick(h.ctx);
  assert.equal(h.state.contracts?.marks.length, 1);
  h.state.units = [];
  const guest = h.unit('ordinary');
  contractsBeforeEntrance(h.ctx, guest);
  assert.equal(guest.hands, 6);
  assert.equal(h.state.contracts?.marks.length, 0);
});
test('Concrete parcels cleanse before entrance and Earth receives the correct larger gain', () => {
  const h = harness(),
    concrete = h.unit('concrete');
  contractsEntrance(h.ctx, concrete);
  const earth = h.unit('ordinary', 1);
  h.custom('ordinary', { element: 'Earth' });
  earth.weakened = true;
  earth.burnStacks = 2;
  contractsBeforeEntrance(h.ctx, earth);
  assert.equal(earth.weakened, false);
  assert.equal(earth.burnStacks, 0);
  assert.equal(earth.hands, 6);
  const other = h.unit('other', 2);
  contractsBeforeEntrance(h.ctx, other);
  assert.equal(other.hands, 5);
  contractsArrived(h.ctx, earth);
  assert.equal(earth.hands, 6);
});
test('Safe Crossing ignores one movement Lock, not Freeze, and keeps the original restriction afterward', () => {
  const h = harness(),
    guard = h.unit('crossing-guard'),
    target = h.unit('ordinary', 0, 2);
  target.movementLocks = [{ sourceId: 'other', expiresAt: 50000 }];
  assert.equal(contractsEntrance(h.ctx, guard), true);
  assert.equal(target.protected, true);
  assert.equal(contractsHasSafeCrossing(h.ctx, target), true);
  target.frozen = true;
  assert.equal(h.ctx.move(target, 1), false);
  assert.equal(contractsHasSafeCrossing(h.ctx, target), true);
  target.frozen = false;
  assert.equal(h.ctx.move(target, 1), true);
  assert.equal(contractsHasSafeCrossing(h.ctx, target), false);
  assert.equal(target.movementLocks?.length, 1);
  assert.equal(h.ctx.move(target, 2), false);
});
test('Laundry cleanses and gives one Hand now, then does so once after a successful move', () => {
  const h = harness(),
    washer = h.unit('laundromat-regular'),
    target = h.unit('ordinary');
  target.silenced = true;
  assert.equal(contractsEntrance(h.ctx, washer), true);
  assert.equal(target.hands, 5);
  assert.equal(target.silenced, false);
  target.burnStacks = 2;
  h.blocked.add(`${target.id}:1`);
  assert.equal(h.ctx.move(target, 1), false);
  assert.equal(target.hands, 5);
  h.blocked.clear();
  h.ctx.move(target, 1);
  assert.equal(target.hands, 6);
  assert.equal(target.burnStacks, 0);
  h.ctx.move(target, 2);
  assert.equal(target.hands, 6);
});
test('Busker pays distinct visitors once in each interval and cannot farm the same arrival', () => {
  const h = harness(),
    busker = h.unit('corner-busker'),
    recipient = h.unit('ordinary', 0, 1),
    first = h.unit('first', 1),
    second = h.unit('second', 2);
  contractsEntrance(h.ctx, busker);
  h.ctx.move(first, 0);
  assert.equal(recipient.hands, 2);
  h.ctx.move(first, 1);
  h.ctx.move(first, 0);
  assert.equal(recipient.hands, 2);
  h.ctx.move(second, 0);
  assert.equal(recipient.hands, 4);
  h.ctx.move(second, 2);
  h.ctx.move(second, 0);
  assert.equal(recipient.hands, 4);
  h.state.elapsedMs = 10000;
  h.ctx.move(first, 1);
  h.ctx.move(first, 0);
  assert.equal(recipient.hands, 5);
});
test('Night Cashier opens at30 seconds, supports a local discount, and switches to Hands in Last Stand', () => {
  const h = harness(),
    cashier = h.unit('night-cashier');
  assert.equal(contractsEntrance(h.ctx, cashier), false);
  h.state.elapsedMs = 30000;
  assert.equal(contractsEntrance(h.ctx, cashier), true);
  const cheap = h.unit('ordinary');
  contractsPlayed(h.ctx, cheap);
  const quote = contractsDiscount(h.ctx, 'player', h.ctx.definition(cheap), 0);
  assert.equal(quote?.amount, 1);
  assert.equal(quote?.minimum, 1);
  assert.equal(
    contractsDiscount(h.ctx, 'player', h.ctx.definition(cheap), 1),
    undefined,
  );
  const e = harness();
  e.state.elapsedMs = 150000;
  const late = e.unit('night-cashier');
  contractsEntrance(e.ctx, late);
  const customer = e.unit('ordinary');
  contractsPlayed(e.ctx, customer);
  assert.equal(customer.hands, 6);
  assert.equal(e.state.contracts?.discounts.length, 0);
});
test('Divorced Dad protects its pickup and grants one reward for an actual later trip home', () => {
  const h = harness(),
    dad = h.unit('divorced-dad'),
    guest = h.unit('ordinary', 2);
  assert.equal(contractsEntrance(h.ctx, dad), true);
  assert.equal(guest.lane, 0);
  assert.equal(guest.protected, true);
  assert.equal(guest.hands, 4);
  h.ctx.move(guest, 2);
  assert.equal(guest.hands, 5);
  h.ctx.move(guest, 0);
  h.ctx.move(guest, 2);
  assert.equal(guest.hands, 5);
});
test('BBL Nice shares only genuine gains once per pulse; shared gains cannot recurse', () => {
  const h = harness(),
    nice = h.unit('bbl-nice'),
    first = h.unit('first', 1, 1),
    second = h.unit('second', 2, 2);
  assert.equal(contractsEntrance(h.ctx, nice), true);
  h.ctx.gain(first, 3);
  assert.equal(first.hands, 4);
  assert.equal(second.hands, 4);
  h.ctx.gain(first, 1);
  assert.equal(second.hands, 4);
  h.state.elapsedMs = 10000;
  h.ctx.gain(second, 1);
  assert.equal(first.hands, 6);
  assert.equal(second.hands, 5);
});
test('Drama evaluates the paid lane, consumes once even when blocked, and rewards the alternative play', () => {
  for (const same of [true, false]) {
    const h = harness(),
      demon = h.unit('bbl-demon');
    h.unit('enemy', 1, 9, 'opponent');
    contractsEntrance(h.ctx, demon);
    const played = h.unit('other', 2, 4, 'opponent');
    played.protected = true;
    contractsPlayed(h.ctx, played, { paidLane: same ? 1 : 2 });
    assert.equal(demon.hands, same ? 4 : 6);
    assert.equal(played.hands, 4);
    assert.equal(h.state.contracts?.marks.length, 0);
  }
});
test('Floor Sweep leaves a pre-entrance Weaken trap only after moving its ally', () => {
  const h = harness(),
    dancer = h.unit('break-dancer'),
    ally = h.unit('ordinary');
  assert.equal(contractsEntrance(h.ctx, dancer), true);
  assert.equal(ally.lane, 1);
  const enemy = h.unit('enemy', 0, 4, 'opponent');
  contractsBeforeEntrance(h.ctx, enemy);
  assert.equal(enemy.weakened, true);
  assert.equal(
    h.state.contracts?.marks.some((m) => m.kind === 'floor'),
    false,
  );
});
test('Windmill performs two legal legs with two rewards and never rewards a blocked second leg', () => {
  const h = harness(),
    bboy = h.unit('bboy');
  h.unit('ordinary', 1);
  assert.equal(contractsEntrance(h.ctx, bboy), true);
  assert.equal(bboy.lane, 2);
  assert.equal(bboy.hands, 6);
  const e = harness(),
    limited = e.unit('bboy');
  e.unit('ordinary', 1);
  e.blocked.add(`${limited.id}:2`);
  assert.equal(contractsEntrance(e.ctx, limited), true);
  assert.equal(limited.lane, 1);
  assert.equal(limited.hands, 5);
});
test('Verse waits until a paid entrance finishes, while movement collects immediately and echoes never collect', () => {
  const h = harness(),
    rapper = h.unit('failed-rapper');
  contractsEntrance(h.ctx, rapper);
  const guest = h.unit('ordinary');
  contractsBeforeEntrance(h.ctx, guest);
  assert.equal(guest.hands, 4);
  contractsArrived(h.ctx, guest, { echoed: true });
  assert.equal(guest.hands, 4);
  contractsArrived(h.ctx, guest);
  assert.equal(guest.hands, 6);
  contractsEntrance(h.ctx, rapper);
  const moving = h.unit('other', 1);
  h.ctx.move(moving, 0);
  assert.equal(moving.hands, 6);
});
test('Gold Road uses Earth bonuses in each lane and quotes a one-use cross-lane card discount', () => {
  const h = harness(),
    mansa = h.unit('mansa-musa'),
    earth = h.unit('ordinary', 0),
    remote = h.unit('other', 1);
  h.custom('ordinary', { element: 'Earth' });
  assert.equal(contractsEntrance(h.ctx, mansa), true);
  assert.equal(earth.hands, 6);
  assert.equal(remote.hands, 5);
  assert.equal(
    contractsDiscount(h.ctx, 'player', h.ctx.definition(remote), 0),
    undefined,
  );
  const d = contractsDiscount(h.ctx, 'player', h.ctx.definition(remote), 2)!;
  assert.equal(d.amount, 1);
  assert.equal(contractsSpendDiscount(h.ctx, 'player', d.id), true);
  assert.equal(contractsSpendDiscount(h.ctx, 'player', d.id), false);
});
test('Scent persists after departure and grants only one defended Burn attempt per interval', () => {
  const h = harness(),
    criminal = h.unit('cologne-criminal');
  contractsEntrance(h.ctx, criminal);
  h.state.units = [];
  const first = h.unit('enemy', 0, 4, 'opponent');
  first.protected = true;
  contractsBeforeEntrance(h.ctx, first);
  assert.equal(first.burnStacks, undefined);
  const second = h.unit('other', 0, 4, 'opponent');
  contractsBeforeEntrance(h.ctx, second);
  assert.equal(second.burnStacks, undefined);
  h.state.elapsedMs = 10000;
  contractsBeforeEntrance(h.ctx, second);
  assert.equal(second.burnStacks, 2);
  h.state.elapsedMs = 20000;
  contractsTick(h.ctx);
  assert.equal(h.state.contracts?.marks.length, 0);
});
test('Passport entrance and a qualifying losing-lane Water departure can both pay', () => {
  const h = harness(),
    passport = h.unit('passport-bro'),
    water = h.unit('ordinary', 0, 1);
  h.custom('ordinary', { element: 'Water' });
  h.unit('enemy', 0, 10, 'opponent');
  water.silenced = true;
  assert.equal(contractsEntrance(h.ctx, passport), true);
  assert.equal(water.lane, 1);
  assert.equal(water.hands, 6);
  assert.equal(water.silenced, false);
  h.ctx.move(water, 0);
  h.ctx.move(water, 2);
  assert.equal(water.hands, 6);
});
test('Lola feeds guests, then rewards only guests who actually return at the boundary', () => {
  const h = harness(),
    lola = h.unit('lola'),
    first = h.unit('first', 1),
    second = h.unit('second', 2);
  first.silenced = true;
  assert.equal(contractsEntrance(h.ctx, lola), true);
  assert.equal(first.lane, 0);
  assert.equal(second.lane, 0);
  assert.equal(first.hands, 5);
  assert.equal(first.silenced, false);
  second.movementLocks = [{ sourceId: 'other', expiresAt: 20000 }];
  h.state.elapsedMs = 10000;
  contractsTick(h.ctx);
  assert.equal(first.lane, 1);
  assert.equal(first.hands, 6);
  assert.equal(second.lane, 0);
  assert.equal(second.hands, 5);
  assert.equal(
    h.state.contracts?.marks.some((m) => m.kind === 'dinner'),
    false,
  );
});
test('Repo Man tows the highest-bonus remote enemy and transfers actual bonus without damage credit', () => {
  const h = harness(),
    repo = h.unit('repo-man', 0, 1),
    enemy = h.unit('enemy', 2, 4);
  enemy.side = 'opponent';
  enemy.hands = 9;
  enemy.maxHands = 9;
  assert.equal(contractsEntrance(h.ctx, repo), true);
  assert.equal(enemy.lane, 0);
  assert.equal(enemy.hands, 6);
  assert.equal(repo.hands, 4);
  assert.equal(enemy.damageTaken, undefined);
  const e = harness(),
    blocked = e.unit('repo-man'),
    warded = e.unit('enemy', 1, 4, 'opponent');
  warded.hands = 9;
  warded.protected = true;
  assert.equal(contractsEntrance(e.ctx, blocked), false);
  assert.equal(warded.lane, 1);
  assert.equal(warded.hands, 9);
});
test('Mad Hatter carries return bonuses and handles the cheaper/equal guest comparisons', () => {
  for (const relation of [-1, 0, 1]) {
    const h = harness(),
      hatter = h.unit('mad-hatter'),
      leaving = h.unit('leaving', 0, 1),
      incoming = h.unit('incoming', 1, 6);
    h.custom('leaving', { cost: 2 });
    h.custom('incoming', { cost: 2 + relation });
    assert.equal(contractsEntrance(h.ctx, hatter), true);
    assert.equal(incoming.lane, 0);
    assert.equal(
      h.state.players.player.returnedHands!.leaving,
      relation > 0 ? 5 : relation === 0 ? 3 : 2,
    );
    assert.equal(incoming.hands, relation < 0 ? 9 : relation === 0 ? 7 : 6);
    assert.equal(!!incoming.protected, relation > 0);
  }
  const h = harness(),
    solo = h.unit('mad-hatter');
  assert.equal(contractsEntrance(h.ctx, solo), true);
  assert.equal(solo.hands, 6);
});
test('Wanted pays for your actual enemy-caused kill only, while Cowboy remains active', () => {
  for (const outcome of ['enemy', 'sacrifice', 'silenced'] as const) {
    const h = harness(),
      cowboy = h.unit('black-cowboy'),
      victim = h.unit('enemy', 1, 3, 'opponent');
    contractsEntrance(h.ctx, cowboy);
    assert.equal(victim.lane, 0);
    if (outcome === 'silenced') cowboy.silenced = true;
    contractsDestroyed(h.ctx, victim, 'player', outcome !== 'sacrifice');
    assert.equal(cowboy.hands, outcome === 'enemy' ? 7 : 4);
    assert.equal(h.state.contracts?.marks.length, 0);
  }
});
test('Dorothy returns the weakest legal cheap remote ally, carrying one Hand and a persistent next-play discount', () => {
  const h = harness(),
    dorothy = h.unit('dorothy'),
    frozen = h.unit('frozen', 1, 1),
    target = h.unit('ordinary', 2, 2);
  frozen.frozen = true;
  assert.equal(contractsEntrance(h.ctx, dorothy), true);
  assert.equal(h.state.players.player.returnedHands![target.cardId], 3);
  assert.equal(h.state.players.player.hand.includes(target.cardId), true);
  h.state.elapsedMs = 50000;
  assert.equal(
    contractsDiscount(h.ctx, 'player', h.ctx.definition(target), 2)?.kind,
    'card',
  );
});
test('Scarecrow prevalidates the swap and uses a wholly empty legal lane only if no swap exists', () => {
  const h = harness(),
    scarecrow = h.unit('scarecrow'),
    ally = h.unit('ordinary', 2);
  assert.equal(contractsEntrance(h.ctx, scarecrow), true);
  assert.equal(scarecrow.lane, 2);
  assert.equal(ally.lane, 0);
  assert.equal(scarecrow.hands, 5);
  assert.equal(ally.hands, 5);
  const e = harness(),
    solo = e.unit('scarecrow');
  e.unit('enemy', 1, 4, 'opponent');
  assert.equal(contractsEntrance(e.ctx, solo), true);
  assert.equal(solo.lane, 2);
  assert.equal(solo.hands, 5);
});
test('Tin Man distinguishes ordinary placement from movement and Oz travelers, sharing each pulse', () => {
  const h = harness();
  h.unit('tin-man');
  const plain = h.unit('ordinary');
  contractsArrived(h.ctx, plain);
  assert.equal(plain.hands, 5);
  assert.equal(plain.protected, undefined);
  const other = h.unit('other', 1);
  h.ctx.move(other, 0);
  assert.equal(other.hands, 4);
  h.state.elapsedMs = 10000;
  const traveler = h.unit('dorothy');
  contractsArrived(h.ctx, traveler);
  assert.equal(traveler.hands, 6);
  assert.equal(traveler.protected, true);
  h.state.elapsedMs = 20000;
  h.ctx.move(other, 1);
  h.ctx.move(other, 0);
  assert.equal(other.hands, 6);
  assert.equal(other.protected, true);
});
test('Lion protects itself while friendly-alone and pays once for another ally leaving its lane', () => {
  const h = harness(),
    lion = h.unit('lion');
  h.unit('enemy', 0, 4, 'opponent');
  assert.equal(contractsEntrance(h.ctx, lion), true);
  assert.equal(lion.protected, true);
  const ally = h.unit('ordinary');
  h.ctx.move(ally, 1);
  assert.equal(lion.hands, 6);
  h.ctx.move(ally, 0);
  h.ctx.move(ally, 2);
  assert.equal(lion.hands, 6);
});
test('Alice return is once per identity, blocked by a full hand and forbidden during irreversible Last Stand', () => {
  const h = harness(),
    alice = h.unit('alice');
  contractsEntrance(h.ctx, alice);
  h.state.elapsedMs = 10000;
  contractsTick(h.ctx);
  assert.equal(h.returns.length, 1);
  assert.equal(h.state.players.player.returnedHands!.alice, 7);
  h.state.players.player.hand = [];
  const same = h.unit('alice');
  same.id = alice.id;
  h.state.elapsedMs = 20000;
  contractsTick(h.ctx);
  assert.equal(h.returns.length, 1);
  const e = harness(),
    late = e.unit('alice');
  contractsEntrance(e.ctx, late);
  e.state.players.player.hand = ['a', 'b', 'c', 'd'];
  e.state.elapsedMs = 10000;
  contractsTick(e.ctx);
  assert.equal(e.returns.length, 0);
  e.state.players.player.hand = [];
  e.lastStand();
  e.state.elapsedMs = 20000;
  e.state.durationMs = 240000;
  contractsTick(e.ctx);
  assert.equal(e.returns.length, 0);
});
test('GoKarter records genuine visits and pays the third lane once despite later revisits', () => {
  const h = harness(),
    kart = h.unit('yn-gokarter');
  assert.equal(contractsEntrance(h.ctx, kart), true);
  assert.equal(kart.lane, 1);
  assert.equal(kart.hands, 4);
  h.ctx.move(kart, 2);
  assert.equal(kart.hands, 7);
  h.ctx.move(kart, 0);
  h.ctx.move(kart, 1);
  assert.equal(kart.hands, 7);
});
test('Wiseman public prediction is consumed by the next enemy play, with either Weaken or a two-Motion fallback', () => {
  for (const correct of [true, false]) {
    const h = harness(),
      sage = h.unit('homeless-wiseman');
    h.unit('enemy', 2, 9, 'opponent');
    contractsEntrance(h.ctx, sage);
    const enemy = h.unit('other', correct ? 0 : 1, 4, 'opponent');
    contractsPlayed(h.ctx, enemy);
    assert.equal(!!enemy.weakened, correct);
    assert.equal(h.state.contracts?.marks.length, 0);
    if (!correct)
      assert.equal(
        contractsDiscount(
          h.ctx,
          'player',
          { id: 'ordinary', cost: 3, kind: 'character' },
          0,
        )?.amount,
        2,
      );
  }
});
test('Dance Captain requires a different second mover into the first mover’s destination', () => {
  const h = harness();
  h.unit('dance-circle-captain', 2);
  const first = h.unit('first', 1),
    second = h.unit('second', 2);
  h.ctx.move(first, 0);
  assert.equal(first.hands, 4);
  h.ctx.move(first, 1);
  h.ctx.move(first, 0);
  assert.equal(first.hands, 4);
  h.ctx.move(second, 0);
  assert.equal(second.hands, 6);
  assert.equal(second.protected, true);
  h.ctx.move(second, 2);
  h.ctx.move(second, 0);
  assert.equal(second.hands, 6);
});
test('Night Shift Medic fully clears allies and its Light-cleanse passive pays only once per pulse', () => {
  const h = harness(),
    medic = h.unit('night-shift-medic'),
    light = h.unit('ordinary'),
    other = h.unit('other');
  h.custom('ordinary', { element: 'Light' });
  light.silenced = true;
  other.frozen = true;
  other.burnStacks = 2;
  assert.equal(contractsEntrance(h.ctx, medic), true);
  assert.equal(light.hands, 7);
  assert.equal(light.silenced, false);
  assert.equal(other.frozen, false);
  assert.equal(other.burnStacks, 0);
  light.silenced = true;
  h.ctx.cleanse(light);
  assert.equal(light.hands, 7);
  h.state.elapsedMs = 10000;
  light.silenced = true;
  h.ctx.cleanse(light);
  assert.equal(light.hands, 9);
});
test('Mayor nomination grants Protection and one local discount only after an actual move', () => {
  const h = harness(),
    mayor = h.unit('midnight-mayor'),
    guest = h.unit('ordinary');
  contractsEntrance(h.ctx, mayor);
  h.blocked.add(`${guest.id}:1`);
  assert.equal(h.ctx.move(guest, 1), false);
  assert.equal(guest.protected, undefined);
  h.blocked.clear();
  h.ctx.move(guest, 1);
  assert.equal(guest.protected, true);
  assert.equal(
    contractsDiscount(h.ctx, 'player', h.ctx.definition(guest), 1)?.amount,
    1,
  );
});
test('Ahki remembers one departure and one later return, granting no automatic movement or repeated rewards', () => {
  const h = harness(),
    ahki = h.unit('ahki'),
    target = h.unit('ordinary');
  contractsEntrance(h.ctx, ahki);
  assert.equal(target.hands, 5);
  assert.equal(target.lane, 0);
  h.ctx.move(target, 1);
  assert.equal(target.hands, 6);
  h.ctx.move(target, 0);
  assert.equal(target.hands, 7);
  assert.equal(target.protected, true);
  h.ctx.move(target, 2);
  h.ctx.move(target, 0);
  assert.equal(target.hands, 7);
});
test('Tab requires the guest’s real enemy damage or new status and cashes once at the next boundary', () => {
  const h = harness(),
    trick = h.unit('mr-trick');
  contractsEntrance(h.ctx, trick);
  const guest = h.unit('ordinary');
  contractsPlayed(h.ctx, guest);
  const enemy = h.unit('enemy', 0, 10, 'opponent');
  enemy.protected = true;
  h.ctx.damage(guest, enemy, 1);
  h.state.elapsedMs = 10000;
  contractsTick(h.ctx);
  assert.equal(guest.hands, 4);
  h.ctx.damage(guest, enemy, 1);
  h.ctx.damage(guest, enemy, 1);
  h.state.elapsedMs = 20000;
  contractsTick(h.ctx);
  assert.equal(guest.hands, 6);
  contractsTick(h.ctx);
  assert.equal(guest.hands, 6);
});
test('Group Project requires two different elements and genuine successful non-echo entrances', () => {
  const h = harness(),
    author = h.unit('dr-umah');
  contractsEntrance(h.ctx, author);
  const first = h.unit('first'),
    same = h.unit('same'),
    second = h.unit('second');
  h.custom('first', { element: 'Fire' });
  h.custom('same', { element: 'Fire' });
  h.custom('second', { element: 'Water' });
  for (const u of [first, same, second]) u.entranceSucceeded = true;
  contractsEntranceResolved(h.ctx, first, { echoed: true });
  assert.equal(first.hands, 4);
  contractsEntranceResolved(h.ctx, first);
  assert.equal(first.hands, 5);
  contractsEntranceResolved(h.ctx, same);
  assert.equal(same.hands, 4);
  contractsEntranceResolved(h.ctx, second);
  assert.equal(first.hands, 7);
  assert.equal(second.hands, 7);
  assert.equal(author.hands, 5);
  assert.equal(h.state.contracts?.marks.length, 0);
});
test('ATL claim diverts only a real capped refund, and its unused fallback cannot also pay after theft', () => {
  const h = harness(),
    atl = h.unit('atl-scammer');
  contractsEntrance(h.ctx, atl);
  h.state.players.opponent.motion = 9;
  h.ctx.refund('opponent', 2, atl);
  assert.equal(h.state.contracts?.marks.length, 1);
  h.state.players.opponent.motion = 4;
  h.ctx.refund('opponent', 2, atl);
  assert.equal(h.state.players.opponent.motion, 5);
  assert.equal(h.state.players.player.motion, 5);
  assert.equal(h.state.contracts?.marks.length, 0);
  h.state.elapsedMs = 20000;
  contractsTick(h.ctx);
  assert.equal(h.state.contracts?.discounts.length, 0);
  const e = harness(),
    claim = e.unit('atl-scammer');
  contractsEntrance(e.ctx, claim);
  e.state.elapsedMs = 20000;
  contractsTick(e.ctx);
  assert.equal(
    contractsDiscount(
      e.ctx,
      'player',
      { id: 'ordinary', cost: 2, kind: 'character' },
      0,
    )?.amount,
    1,
  );
});
test('Tattoo rewards its next successful move once, and a recycled identity cannot be tattooed again', () => {
  const h = harness(),
    artist = h.unit('tattoo-artist'),
    client = h.unit('ordinary');
  assert.equal(contractsEntrance(h.ctx, artist), true);
  assert.equal(client.hands, 5);
  h.blocked.add(`${client.id}:1`);
  assert.equal(h.ctx.move(client, 1), false);
  assert.equal(client.hands, 5);
  h.blocked.clear();
  h.ctx.move(client, 1);
  assert.equal(client.hands, 6);
  assert.equal(client.protected, true);
  h.state.units = h.state.units.filter((u) => u.id !== client.id);
  h.unit('ordinary');
  assert.equal(contractsEntrance(h.ctx, artist), false);
});
test('OG Skater leaves a route at the origin; only a legal subsequent paid arrival follows it', () => {
  const h = harness(),
    skater = h.unit('og-skater');
  assert.equal(contractsEntrance(h.ctx, skater), true);
  assert.equal(skater.lane, 1);
  const follower = h.unit('ordinary');
  contractsPlayed(h.ctx, follower, { paidLane: 0 });
  assert.equal(follower.lane, 1);
  assert.equal(h.state.contracts?.marks.length, 0);
  const e = harness(),
    other = e.unit('og-skater');
  contractsEntrance(e.ctx, other);
  const blocked = e.unit('ordinary');
  e.blocked.add(`${blocked.id}:1`);
  contractsPlayed(e.ctx, blocked, { paidLane: 0 });
  assert.equal(blocked.lane, 0);
  assert.equal(e.state.contracts?.marks.length, 0);
});
test('contract quotes and Safe Crossing queries are read-only and scoped expiry is exact', () => {
  const h = harness(),
    ordinary = h.unit('ordinary'),
    before = JSON.stringify(h.state);
  assert.equal(contractsHasSafeCrossing(h.ctx, ordinary), false);
  assert.equal(
    contractsDiscount(h.ctx, 'player', h.ctx.definition(ordinary), 0),
    undefined,
  );
  contractsTick(h.ctx);
  assert.equal(JSON.stringify(h.state), before);
  const source = h.unit('concrete');
  contractsEntrance(h.ctx, source);
  h.state.elapsedMs = 20000;
  contractsTick(h.ctx);
  assert.equal(h.state.contracts?.marks.length, 0);
});
test('contract cloning is independent and persistent setup echoes cannot re-arm a second payoff', () => {
  const h = harness(),
    source = h.unit('concrete');
  contractsEntrance(h.ctx, source);
  const original = JSON.stringify(h.state.contracts),
    clone = cloneContractsRuntime(h.state.contracts)!;
  clone.marks[0].source.hands = 0;
  clone.seats.player.used.changed = 1;
  assert.equal(JSON.stringify(h.state.contracts), original);
  assert.equal(cloneContractsRuntime(undefined), undefined);
  assert.equal(contractsEntrance(h.ctx, source, { echoed: true }), false);
  assert.equal(JSON.stringify(h.state.contracts), original);
});
test('all35 kits reject disabled sources, and identical event sequences produce identical contract receipts', () => {
  for (const id of Object.keys(CONTRACT_ADAPTERS)) {
    const run = () => {
      const h = harness(),
        source = h.unit(id);
      h.unit('first');
      h.unit('second', 1);
      h.unit('third', 2);
      h.unit('enemy', 0, 8, 'opponent');
      source.silenced = true;
      const before = JSON.stringify(h.state);
      assert.equal(contractsEntrance(h.ctx, source), false, id);
      assert.equal(JSON.stringify(h.state), before, id);
      source.silenced = false;
      contractsEntrance(h.ctx, source);
      return JSON.stringify(h.state);
    };
    assert.equal(run(), run(), id);
  }
});
test('A combat-borrowed return sends targeted discount and extra Hatter Hands to actual owner, preserving source attribution', () => {
  const h = harness(),
    actor = h.unit('mad-hatter'),
    borrowed = h.unit('borrowed', 0, 2),
    guest = h.unit('guest', 1, 4);
  h.custom('borrowed', { cost: 2 });
  h.custom('guest', { cost: 4 });
  h.ctx.returnToHand = (source, target, options) => {
    target.side = 'opponent';
    h.state.players.opponent.hand.push(target.cardId);
    h.state.players.opponent.returnedHands![target.cardId] =
      target.hands + options.bonusHands;
    h.state.units = h.state.units.filter((u) => u.id !== target.id);
    return true;
  };
  assert.equal(contractsEntrance(h.ctx, actor), true);
  assert.equal(h.state.players.opponent.returnedHands!.borrowed, 6);
  assert.equal(h.state.players.player.returnedHands!.borrowed, undefined);
  const quote = contractsDiscount(
    h.ctx,
    'opponent',
    h.ctx.definition(borrowed),
    0,
  )!;
  assert.equal(quote.amount, 1);
  assert.equal(quote.source.side, 'player');
  assert.equal(quote.source.id, actor.id);
  assert.equal(
    contractsDiscount(h.ctx, 'player', h.ctx.definition(borrowed), 0),
    undefined,
  );
  assert.equal(guest.protected, true);
});
