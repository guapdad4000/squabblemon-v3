import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardCatalog } from './src/data';
import {
  createGame,
  type FighterDefinition,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import {
  CONTROL_ADAPTERS,
  CONTROL_ABILITY_DESCRIPTIONS,
  cloneControlState,
  controlQuoteCost,
  controlSpendCost,
  controlEntrance,
  controlBeforeEntrance,
  controlBeforeMove,
  controlArrived,
  controlMoved,
  controlPlayed,
  controlDeferStatuses,
  controlCleansed,
  controlDamaged,
  controlShieldBlocked,
  controlDestroyed,
  controlPulse,
  type ControlContext,
  type ControlMatchState,
  type ControlStatusChange,
} from './src/breakthroughControl';
const defs = new Map<string, FighterDefinition>();
for (const c of cardCatalog) {
  const adapter =
    CONTROL_ADAPTERS[c.catalogId as keyof typeof CONTROL_ADAPTERS];
  defs.set(c.catalogId, {
    id: c.catalogId,
    name: c.name,
    kind: c.kind === 'support' ? 'support' : 'character',
    cost: c.cost,
    hands: c.power,
    art: '',
    description: c.effect,
    element: c.type,
    engineId: c.engineId,
    ability: (adapter?.ability ?? 'none') as FighterDefinition['ability'],
    ...(adapter ? { triggers: adapter.triggers } : {}),
  });
}
defs.set('plain', {
  id: 'plain',
  name: 'Plain',
  cost: 2,
  hands: 6,
  art: '',
  description: '',
  ability: 'none',
  kind: 'character',
  element: 'Normal',
});
defs.set('poison', { ...defs.get('plain')!, id: 'poison', element: 'Poison' });
defs.set('electric', {
  ...defs.get('plain')!,
  id: 'electric',
  element: 'Electric',
});
defs.set('air', { ...defs.get('plain')!, id: 'air', element: 'Air' });
defs.set('action', {
  ...defs.get('plain')!,
  id: 'action',
  kind: 'support',
  element: 'Electric',
});
defs.set('expensive', { ...defs.get('plain')!, id: 'expensive', cost: 5 });
function u(
  id: string,
  cardId = 'plain',
  lane: Lane = 0,
  side: Side = 'player',
  hands?: number,
): Unit {
  const base = defs.get(cardId)?.hands ?? 6;
  return {
    id,
    cardId,
    side,
    lane,
    position: side === 'player' ? 0.3 : 0.7,
    hands: hands ?? base,
    baseHands: base,
    maxHands: hands ?? base,
    squabbled: false,
    nextEffectAt: 999999,
  };
}
function fixture(units: Unit[] = []) {
  const dummy = Array.from({ length: 10 }, (_, i): FighterDefinition => ({
    ...defs.get('plain')!,
    id: `dummy-${i}`,
  }));
  const state = createGame(dummy) as ReturnType<typeof createGame> & {
    control?: ControlMatchState;
  };
  state.units = units;
  state.roster = [...defs.values()];
  state.players.player.hand = [];
  state.players.opponent.hand = [];
  const blocked = new Set<string>(),
    tokens = new Set<string>(),
    redirects = new Map<string, Unit>(),
    deferred: string[] = [];
  let packages = 0;
  const ctx: ControlContext = {
    state,
    definition: (x) => defs.get(x.cardId)!,
    active: (x) => x.hands > 0 && !x.frozen && !x.silenced && !x.weakened,
    effectiveHands: (x) => (x.frozen ? 0 : Math.max(0, x.hands)),
    ongoing: (x) =>
      (
        (
          defs.get(x.cardId) as FighterDefinition & {
            triggers?: readonly string[];
          }
        ).triggers ?? []
      ).includes('ongoing'),
    hasEntrance: (x) =>
      (
        (
          defs.get(x.cardId) as FighterDefinition & {
            triggers?: readonly string[];
          }
        ).triggers ?? []
      ).includes('entrance') || x.cardId === 'expensive',
    isAfflicted: (x) =>
      !!(
        x.frozen ||
        x.silenced ||
        x.weakened ||
        x.burnStacks ||
        (x.movementLocks ?? []).some((l) => l.expiresAt > state.elapsedMs)
      ),
    gain(x, n) {
      if (x.hands > 0 && n > 0) {
        x.hands += n;
        x.maxHands += n;
      }
    },
    protect(x) {
      x.protected = true;
    },
    cleanse(x) {
      x.frozen = false;
      x.silenced = false;
      x.weakened = false;
      x.burnStacks = 0;
      delete x.movementLocks;
      state.statuses = state.statuses.filter((s) => s.targetId !== x.id);
      controlCleansed(ctx, x);
    },
    clearBurn(x) {
      x.burnStacks = 0;
      state.statuses = state.statuses.filter(
        (s) => s.targetId !== x.id || s.kind !== 'burn',
      );
    },
    heal(x, n) {
      if (x.hands <= 0) return 0;
      const actual = Math.min(
        n,
        x.damageTaken ?? 0,
        Math.max(0, x.maxHands - x.hands),
      );
      x.hands += actual;
      x.damageTaken = (x.damageTaken ?? 0) - actual;
      return actual;
    },
    hostilePackage(source, target, apply) {
      packages++;
      target = redirects.get(target.id) ?? target;
      if (target.hands <= 0 || target.immune) return false;
      if (target.protected) {
        target.protected = false;
        controlShieldBlocked(ctx, source.side, source.id, target);
        return false;
      }
      apply(target);
      return true;
    },
    rawDamage(source, target, n, options = {}) {
      if (target.hands <= 0) return 0;
      const actual = Math.min(target.hands, Math.max(0, n));
      target.hands -= actual;
      target.damageTaken = (target.damageTaken ?? 0) + actual;
      controlDamaged(ctx, source.side, source.id, target, actual, options);
      if (target.hands <= 0)
        controlDestroyed(ctx, target, source.side, options);
      return actual;
    },
    strike(source, target, n, options = {}) {
      let actual = 0;
      ctx.hostilePackage(source, target, (recipient) => {
        actual = ctx.rawDamage(source, recipient, n, options);
      });
      return actual;
    },
    removableBonus: (x) =>
      Math.max(0, Math.min(x.hands, x.maxHands - x.baseHands)),
    rawBonus(source, x, cap) {
      const n = Math.min(cap, ctx.removableBonus(x));
      x.hands -= n;
      x.maxHands -= n;
      return n;
    },
    rawStatus(source, target, change) {
      if (target.hands <= 0) return false;
      const start = change.startsAt ?? state.elapsedMs,
        duration = change.durationMs ?? (change.kind === 'burn' ? 6000 : 10000);
      if (change.kind === 'lock') {
        const old = (target.movementLocks ?? []).some(
          (l) => l.sourceId === source.id && l.expiresAt >= start + duration,
        );
        target.movementLocks = [
          ...(target.movementLocks ?? []).filter(
            (l) => l.sourceId !== source.id,
          ),
          { sourceId: source.id, expiresAt: start + duration },
        ];
        return !old;
      }
      let added = false;
      if (change.kind === 'burn') {
        const n = change.stacks ?? 1;
        target.burnStacks = (target.burnStacks ?? 0) + n;
        added = n > 0;
      } else {
        const key =
          change.kind === 'freeze'
            ? 'frozen'
            : change.kind === 'silence'
              ? 'silenced'
              : 'weakened';
        added = !target[key];
        target[key] = true;
      }
      state.statuses.push({
        id: state.nextEffectId++,
        kind: change.kind,
        targetId: target.id,
        sourceUnitId: source.id,
        sourceSide: source.side,
        sourceLane: source.lane,
        sourcePosition: source.position,
        appliedAt: start,
        nextTickAt: start + 2000,
        expiresAt: start + duration,
        stacks: change.stacks ?? 1,
      });
      return added;
    },
    burn(source, target, n, options = {}) {
      let added = false;
      ctx.hostilePackage(source, target, (actual) => {
        added = ctx.rawStatus(source, actual, {
          kind: 'burn',
          stacks: n,
          ...options,
        });
      });
      return added;
    },
    openForMove(x, lane) {
      return (
        x.hands > 0 &&
        !x.frozen &&
        !(x.movementLocks ?? []).some((l) => l.expiresAt > state.elapsedMs) &&
        x.lane !== lane &&
        !blocked.has(`${x.id}:${lane}`)
      );
    },
    move(x, lane) {
      if (!ctx.openForMove(x, lane) || !controlBeforeMove(ctx, x, lane))
        return false;
      const old = x.lane;
      x.lane = lane;
      controlMoved(ctx, x, old);
      return true;
    },
    rawMove(source, x, lane) {
      return ctx.move(x, lane);
    },
    resolveEntrance(x) {
      deferred.push(x.id);
      return !!controlEntrance(ctx, x);
    },
    event(e) {
      state.events.push({ ...e, id: state.nextEventId++ });
    },
    isToken: (x) => tokens.has(x.id),
  };
  function enter(x: Unit) {
    if (!state.units.includes(x)) state.units.push(x);
    controlPlayed(ctx, x);
    controlArrived(ctx, x);
    const intercepted = controlBeforeEntrance(ctx, x);
    if (!intercepted.cancelled && intercepted.delayUntil === undefined)
      controlEntrance(ctx, x);
    return intercepted;
  }
  function at(ms: number) {
    state.elapsedMs = ms;
    controlPulse(ctx);
  }
  return {
    state,
    ctx,
    blocked,
    tokens,
    redirects,
    deferred,
    enter,
    at,
    packages: () => packages,
  };
}

test('all26 canonical control IDs have explicit triggers and unique implemented contracts', () => {
  assert.equal(Object.keys(CONTROL_ADAPTERS).length, 26);
  assert.equal(
    new Set(Object.values(CONTROL_ADAPTERS).map((x) => x.ability)).size,
    26,
  );
  for (const [id, a] of Object.entries(CONTROL_ADAPTERS)) {
    assert.ok(defs.has(id), id);
    assert.ok(CONTROL_ABILITY_DESCRIPTIONS[a.ability].length > 30);
    assert.ok(a.triggers.length);
  }
  assert.deepEqual(CONTROL_ADAPTERS.landlord.triggers, ['ongoing']);
  assert.deepEqual(CONTROL_ADAPTERS['the-mailman'].triggers, ['ongoing']);
  assert.deepEqual(CONTROL_ADAPTERS.promoter.triggers, ['entrance', 'ongoing']);
});
test('cost preview is read-only including before any runtime exists', () => {
  const land = u('land', 'landlord', 0, 'opponent');
  const f = fixture([land]);
  const before = JSON.stringify(f.state);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'plain', 0, 2).cost, 3);
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(f.state.control, undefined);
});
test('Landlord copies share pulse, actual payment only and rejected affordability pays nothing', () => {
  const a = u('a', 'landlord', 0, 'opponent'),
    b = u('b', 'landlord', 0, 'opponent');
  const f = fixture([a, b]);
  f.state.players.player.motion = 2;
  let q = controlQuoteCost(f.ctx, 'player', 'plain', 0, 2);
  assert.equal(q.cost, 3);
  assert.equal(a.hands, 3);
  assert.equal(f.state.control, undefined);
  f.state.players.player.motion = 4;
  f.state.players.player.motion -= q.cost;
  controlSpendCost(f.ctx, q);
  assert.equal(a.hands, 4);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'plain', 0, 2).cost, 2);
  controlSpendCost(f.ctx, q);
  assert.equal(a.hands, 4);
  f.at(10000);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'action', 0, 2).cost, 3);
});
test('BottleGirl30-second bonus, Poison-only minimum and finite expiry', () => {
  const bottle = u('b', 'bottle-girl');
  const f = fixture([bottle]);
  f.state.elapsedMs = 30000;
  controlEntrance(f.ctx, bottle);
  assert.equal(bottle.hands, 5);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'plain', 0, 2).cost, 2);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'poison', 1, 1).cost, 1);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'poison', 1, 0).cost, 0);
  f.at(50000);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'poison', 1, 2).cost, 2);
});
test('Promoter reveal is private/stable; discount targets other lane and can be declined', () => {
  const p = u('p', 'promoter');
  const f = fixture([p]);
  f.state.players.opponent.hand = ['plain', 'expensive'];
  controlEntrance(f.ctx, p);
  assert.equal(f.state.events[0].visibleTo, 'player');
  assert.equal(f.state.events[0].cardId, 'expensive');
  assert.equal(controlQuoteCost(f.ctx, 'player', 'action', 0, 2).cost, 2);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'action', 1, 2).cost, 1);
  assert.equal(
    controlQuoteCost(f.ctx, 'player', 'action', 1, 2, false).cost,
    2,
  );
  assert.equal(f.state.control!.discounts.length, 1);
});
test('Promoter movement buff is one shared active-source payment per interval', () => {
  const p = u('p', 'promoter'),
    p2 = u('p2', 'promoter'),
    air = u('air', 'air', 1),
    bottle = u('b', 'bottle-girl', 2);
  const f = fixture([p, p2, air, bottle]);
  f.ctx.move(air, 0);
  assert.equal(air.hands, 8);
  f.ctx.move(bottle, 1);
  assert.equal(bottle.hands, 3);
  f.at(10000);
  p.silenced = true;
  p2.silenced = true;
  f.ctx.move(air, 2);
  assert.equal(air.hands, 8);
  p2.silenced = false;
  f.ctx.move(bottle, 2);
  assert.equal(bottle.hands, 5);
});
test('Fork marks strongest per lane in lane order and next placement saves its lane', () => {
  const chess = u('c', 'chess-regular'),
    a = u('a', 'plain', 0, 'opponent', 7),
    b = u('b', 'plain', 1, 'opponent', 8),
    c = u('c2', 'plain', 2, 'opponent', 30);
  const f = fixture([chess, a, b, c]);
  controlEntrance(f.ctx, chess);
  assert.deepEqual(f.state.control!.forks[0].targets, ['a', 'b']);
  f.enter(u('new', 'plain', 0, 'opponent'));
  assert.equal(a.hands, 7);
  assert.equal(b.hands, 6);
  assert.equal(c.hands, 30);
  assert.equal(chess.hands, 2);
  assert.equal(f.state.control!.forks.length, 0);
});
test('one-mark Fork waits for completion then a later paid placement, not movement', () => {
  const chess = u('c', 'chess-regular'),
    a = u('a', 'plain', 0, 'opponent', 7);
  const f = fixture([chess, a]);
  controlEntrance(f.ctx, chess);
  f.enter(u('b', 'plain', 1, 'opponent', 8));
  assert.equal(a.hands, 7);
  assert.equal(f.state.control!.forks[0].complete, true);
  f.ctx.move(a, 2);
  assert.equal(a.hands, 7);
  chess.silenced = true;
  f.enter(u('next', 'plain', 1, 'opponent'));
  assert.equal(a.hands, 5);
  assert.equal(chess.hands, 1);
});
test('Goth takes first completely empty legal lane and silences before arriving ability', () => {
  const g = u('g', 'goth-kid'),
    occupied = u('o', 'plain', 1);
  const f = fixture([g, occupied]);
  controlEntrance(f.ctx, g);
  assert.equal(g.lane, 2);
  const dmv = u('d', 'dmv-worker', 2, 'opponent');
  f.enter(dmv);
  assert.equal(dmv.silenced, true);
  assert.equal(dmv.hands, 2);
  assert.equal(f.state.control!.tickets.length, 0);
  assert.equal(f.state.control!.goths.length, 0);
});
test('Goth disabled source cannot consume the waiting first-arrival trap; fallback uses printed cost', () => {
  const g = u('g', 'goth-kid');
  const f = fixture([g]);
  controlEntrance(f.ctx, g);
  g.weakened = true;
  const a = u('a', 'plain', g.lane, 'opponent');
  f.enter(a);
  assert.equal(a.silenced, undefined);
  assert.equal(f.state.control!.goths.length, 1);
  g.weakened = false;
  const b = u('b', 'plain', g.lane, 'opponent');
  b.protected = true;
  f.enter(b);
  assert.equal(b.silenced, undefined);
  assert.equal(f.state.control!.goths.length, 0);
  const g2 = u('g2', 'goth-kid'),
    cheap = u('cheap', 'plain', 0, 'opponent', 5),
    costly = u('costly', 'expensive', 0, 'opponent', 1);
  const f2 = fixture([
    g2,
    cheap,
    costly,
    u('l1', 'plain', 1),
    u('l2', 'plain', 2),
  ]);
  controlEntrance(f2.ctx, g2);
  assert.equal(cheap.silenced, true);
  assert.equal(costly.silenced, undefined);
});
test('Stoner cleanse leaves4 then1 for different real arrivals without marching tokens', () => {
  const s = u('s', 'stoner-sr'),
    dirty = u('dirty', 'plain', 0, 'player', 2);
  dirty.silenced = true;
  const f = fixture([s, dirty]);
  controlEntrance(f.ctx, s);
  assert.equal(dirty.silenced, false);
  s.hands = 0;
  const a = u('a', 'plain'),
    b = u('b', 'plain');
  f.enter(a);
  assert.equal(a.hands, 10);
  controlArrived(f.ctx, a);
  assert.equal(a.hands, 10);
  f.enter(b);
  assert.equal(b.hands, 7);
  assert.equal(f.state.control!.stoners.length, 0);
  assert.equal(f.state.units.length, 4);
});
test('Stoner non-cleanse token is once and actions/summons cannot spend it', () => {
  const s = u('s', 'stoner-sr');
  const f = fixture([s]);
  controlEntrance(f.ctx, s);
  const action = u('act', 'action'),
    token = u('tok', 'plain');
  f.tokens.add(token.id);
  f.enter(action);
  f.enter(token);
  assert.equal(f.state.control!.stoners.length, 1);
  const a = u('a');
  f.enter(a);
  assert.equal(a.hands, 10);
  assert.equal(f.state.control!.stoners.length, 0);
});
test('Seafood detonates all Burn in one defended package without cleansing other statuses', () => {
  const s = u('s', 'seafood-assassin'),
    a = u('a', 'plain', 0, 'opponent', 10),
    b = u('b', 'plain', 0, 'opponent', 10);
  a.burnStacks = 3;
  a.silenced = true;
  a.frozen = true;
  a.movementLocks = [{ sourceId: 'other', expiresAt: 20000 }];
  b.protected = true;
  const f = fixture([s, a, b]);
  controlEntrance(f.ctx, s);
  assert.equal(a.hands, 5);
  assert.equal(a.burnStacks, 0);
  assert.equal(a.silenced, true);
  assert.equal(a.frozen, true);
  assert.equal(a.movementLocks.length, 1);
  assert.equal(b.hands, 10);
  assert.equal(b.burnStacks, undefined);
  assert.equal(b.protected, false);
  assert.equal(f.packages(), 2);
});
test('Hookah requires actual Burn damage while active and relays with future start', () => {
  const h = u('h', 'god-of-hookah'),
    a = u('a', 'plain', 0, 'opponent', 10),
    b = u('b', 'plain', 1, 'opponent', 10);
  const f = fixture([h, a, b]);
  a.burnStacks = 1;
  controlDamaged(f.ctx, 'player', 'h', a, 0, { burn: true });
  f.at(10000);
  assert.equal(b.burnStacks, undefined);
  f.ctx.rawDamage(h, a, 1, { burn: true });
  f.at(20000);
  assert.equal(b.burnStacks, 1);
  const st = f.state.statuses.find((x) => x.targetId === 'b')!;
  assert.equal(st.appliedAt, 30000);
  assert.equal(st.expiresAt, 36000);
  h.silenced = true;
  f.ctx.rawDamage(h, a, 1, { burn: true });
  h.silenced = false;
  f.at(30000);
  assert.equal(b.burnStacks, 1);
});
test('Hookah already-burning destinations pay at most1 per pulse and empty lanes pay none', () => {
  const h = u('h', 'god-of-hookah'),
    a = u('a', 'plain', 0, 'opponent', 10),
    b = u('b', 'plain', 1, 'opponent', 10),
    c = u('c', 'plain', 2, 'opponent', 10);
  const f = fixture([h, a, b, c]);
  for (const x of [a, b, c]) x.burnStacks = 1;
  f.ctx.rawDamage(h, a, 1, { burn: true });
  f.ctx.rawDamage(h, b, 1, { burn: true });
  f.at(10000);
  assert.equal(h.hands, 4);
  f.ctx.rawDamage(h, c, 1, { burn: true });
  a.hands = 0;
  f.at(20000);
  assert.equal(h.hands, 4);
});
test('Mailman second realElectric play creates one package, resolved discount bonus cannot double spend', () => {
  const m = u('m', 'the-mailman');
  const f = fixture([m]);
  f.enter(u('a', 'electric', 0));
  f.enter(u('act', 'action', 2));
  assert.equal(f.state.control!.discounts.length, 0);
  f.enter(u('b', 'electric', 0));
  const token = f.state.control!.discounts[0];
  assert.equal(token.lane, 1);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'plain', 1, 2).cost, 2);
  const q = controlQuoteCost(f.ctx, 'player', 'electric', 1, 2);
  assert.equal(q.cost, 1);
  assert.equal(q.bonusHands, 2);
  assert.equal(controlSpendCost(f.ctx, q), 2);
  assert.equal(controlSpendCost(f.ctx, q), 0);
  assert.equal(f.state.control!.discounts.length, 0);
});
test('Stakeout survives creator silence and cancels only a real entrance; optional rewards require active', () => {
  const s = u('s', 'sherlock'),
    ally = u('a', 'plain', 2, 'player', 1);
  const f = fixture([s, ally]);
  controlEntrance(f.ctx, s);
  s.silenced = true;
  assert.deepEqual(f.enter(u('passive', 'landlord', 1, 'opponent')), {});
  assert.equal(f.state.control!.stakeouts.length, 1);
  const d = u('d', 'dmv-worker', 1, 'opponent');
  assert.deepEqual(f.enter(d), { cancelled: true });
  assert.equal(d.hands, 2);
  assert.equal(d.lane, 1);
  assert.equal(s.hands, 2);
  assert.equal(ally.hands, 1);
  assert.equal(f.state.control!.stakeouts.length, 0);
});
test('active Stakeout rewards exactly once and closes both watched lanes', () => {
  const s = u('s', 'sherlock'),
    ally = u('a', 'plain', 2, 'player', 1);
  const f = fixture([s, ally]);
  controlEntrance(f.ctx, s);
  f.enter(u('d', 'dmv-worker', 1, 'opponent'));
  assert.equal(s.hands, 4);
  assert.equal(ally.hands, 3);
  const d2 = u('d2', 'dmv-worker', 2, 'opponent');
  f.enter(d2);
  assert.equal(d2.hands, 3);
});
test('DMV defers only ability: paid unit immediate, new inputs unaffected, no repeat', () => {
  const d = u('d', 'dmv-worker');
  const f = fixture([d]);
  controlEntrance(f.ctx, d);
  const enemy = u('e', 'bottle-girl', 0, 'opponent');
  assert.deepEqual(f.enter(enemy), { delayUntil: 10000 });
  assert.ok(f.state.units.includes(enemy));
  assert.equal(f.state.control!.discounts.length, 0);
  const other = u('other', 'bottle-girl', 1, 'opponent');
  f.enter(other);
  assert.equal(f.state.control!.discounts.length, 1);
  f.at(10000);
  assert.deepEqual(f.deferred, ['e']);
  assert.equal(f.state.control!.discounts.length, 1);
  assert.deepEqual(controlBeforeEntrance(f.ctx, enemy), {});
  assert.equal(f.state.units.length, 3);
});
test('DMV delayed ability is discarded when target dies or is disabled, without restoring ticket', () => {
  for (const effect of ['dead', 'silenced'] as const) {
    const d = u('d', 'dmv-worker'),
      f = fixture([d]);
    controlEntrance(f.ctx, d);
    const e = u('e', 'bottle-girl', 0, 'opponent');
    f.enter(e);
    if (effect === 'dead') e.hands = 0;
    else e.silenced = true;
    f.at(10000);
    assert.deepEqual(f.deferred, []);
    assert.equal(f.state.control!.deferred.length, 0);
    assert.equal(f.state.control!.tickets.length, 0);
  }
});
test('Watson restores only actual injury, then protects all active Sherlocks', () => {
  const w = u('w', 'watson'),
    a = u('a', 'plain', 0, 'player', 2),
    s = u('s', 'sherlock', 2);
  a.maxHands = 9;
  a.damageTaken = 4;
  const f = fixture([w, a, s]);
  controlEntrance(f.ctx, w);
  assert.equal(a.hands, 5);
  assert.equal(a.damageTaken, 1);
  assert.equal(a.maxHands, 9);
  assert.equal(a.protected, true);
  assert.equal(s.hands, 4);
  assert.equal(s.protected, true);
});
test('Feds confiscates only removable bonus without injury and applies movement-only Lock', () => {
  const federal = u('f', 'the-feds'),
    a = u('a', 'plain', 0, 'opponent', 16);
  a.maxHands = 16;
  const f = fixture([federal, a]);
  controlEntrance(f.ctx, federal);
  assert.equal(a.hands, 8);
  assert.equal(a.maxHands, 8);
  assert.equal(a.damageTaken, undefined);
  assert.equal(a.frozen, undefined);
  assert.equal(a.weakened, undefined);
  assert.equal(a.movementLocks?.length, 1);
  assert.equal(f.ctx.active(a), true);
  assert.equal(f.ctx.openForMove(a, 1), false);
  f.ctx.cleanse(a);
  assert.equal(f.ctx.openForMove(a, 1), true);
});
test('Feds fallback whole package blocked by one shield and exact recipient after redirect', () => {
  const federal = u('f', 'the-feds'),
    a = u('a', 'plain', 0, 'opponent'),
    b = u('b', 'plain', 0, 'opponent');
  a.protected = true;
  const f = fixture([federal, a, b]);
  controlEntrance(f.ctx, federal);
  assert.equal(a.protected, false);
  assert.equal(a.weakened, undefined);
  assert.equal(a.movementLocks, undefined);
  f.redirects.set('a', b);
  controlEntrance(f.ctx, federal);
  assert.equal(b.weakened, true);
  assert.equal(b.movementLocks?.length, 1);
});
test('PTang one defended package hits and moves actual retargeted survivor', () => {
  const p = u('p', 'p-tang'),
    a = u('a', 'plain', 0, 'opponent', 10),
    b = u('b', 'plain', 0, 'opponent', 8);
  const f = fixture([p, a, b]);
  f.redirects.set(a.id, b);
  controlEntrance(f.ctx, p);
  assert.equal(a.hands, 10);
  assert.equal(b.hands, 5);
  assert.equal(b.lane, 1);
  assert.equal(f.packages(), 1);
  assert.equal(p.hands, 4);
});
test('PTang gains only once for positive damage on unmoved survivor, not shield or lethal', () => {
  const p = u('p', 'p-tang'),
    a = u('a', 'plain', 0, 'opponent', 20);
  const f = fixture([p, a]);
  f.blocked.add('a:1');
  f.blocked.add('a:2');
  controlEntrance(f.ctx, p);
  assert.equal(p.hands, 6);
  controlEntrance(f.ctx, p, true);
  assert.equal(p.hands, 6);
  a.protected = true;
  controlEntrance(f.ctx, p);
  assert.equal(p.hands, 6);
  a.hands = 2;
  controlEntrance(f.ctx, p);
  assert.equal(p.hands, 6);
});
test('Ronald reacts only to actual enemy damage on another ally, shared once per interval', () => {
  const r = u('r', 'revolutionary-ronald'),
    v = u('v', 'plain'),
    backup = u('b', 'plain', 1, 'player', 2),
    extra = u('e', 'plain', 2, 'player', 3),
    enemy = u('atk', 'plain', 0, 'opponent');
  const f = fixture([r, v, backup, extra, enemy]);
  controlDamaged(f.ctx, 'opponent', enemy.id, v, 0);
  controlDamaged(f.ctx, 'player', r.id, v, 1);
  assert.equal(backup.lane, 1);
  f.ctx.rawDamage(enemy, r, 1);
  assert.equal(backup.lane, 1);
  f.ctx.rawDamage(enemy, v, 1);
  assert.equal(backup.lane, 0);
  assert.equal(backup.protected, true);
  f.ctx.rawDamage(enemy, v, 1);
  assert.equal(extra.lane, 2);
});
test('Chair observes another ally personal shield and persists match receipt through recycle', () => {
  const c = u('c', 'juneteenth-chair-guy'),
    v = u('v', 'plain'),
    enemy = u('enemy', 'plain', 0, 'opponent', 12);
  const f = fixture([c, v, enemy]);
  v.protected = true;
  f.ctx.strike(enemy, v, 4);
  assert.equal(v.hands, 6);
  assert.equal(enemy.hands, 9);
  assert.equal(v.protected, true);
  c.hands = 0;
  const c2 = u('c2', 'juneteenth-chair-guy');
  f.state.units.push(c2);
  f.ctx.rawDamage(enemy, v, 1);
  assert.equal(enemy.hands, 9);
});
test('Redneck primer fires once on Burn or earlier own-side defeat and splash cannot chain', () => {
  const r = u('r', 'redneck-evil'),
    a = u('a', 'plain', 0, 'opponent', 12),
    b = u('b', 'plain', 0, 'opponent', 10),
    c = u('c', 'plain', 0, 'opponent', 11);
  const f = fixture([r, a, b, c]);
  controlEntrance(f.ctx, r);
  assert.equal(a.burnStacks, 2);
  f.ctx.rawDamage(r, a, 1, { burn: true });
  assert.equal(b.hands, 8);
  assert.equal(f.state.control!.primers.length, 0);
  f.ctx.rawDamage(r, a, 1, { burn: true });
  assert.equal(b.hands, 8);
  const r2 = u('r2', 'redneck-evil');
  a.hands = 13;
  f.state.units.push(r2);
  controlEntrance(f.ctx, r2);
  f.ctx.rawDamage(r, a, 20);
  assert.equal(b.hands, 6);
});
test('Redneck protection blocks primer and a splash cannot trigger another primed target', () => {
  const r = u('r', 'redneck-evil'),
    a = u('a', 'plain', 0, 'opponent', 12),
    b = u('b', 'plain', 0, 'opponent', 10),
    c = u('c', 'plain', 0, 'opponent', 5);
  const f = fixture([r, a, b, c]);
  a.protected = true;
  assert.equal(controlEntrance(f.ctx, r), false);
  assert.equal(f.state.control!.primers.length, 0);
  controlEntrance(f.ctx, r);
  a.hands = 8;
  controlEntrance(f.ctx, r);
  assert.equal(f.state.control!.primers.length, 2);
  c.hands = 0;
  f.ctx.rawDamage(r, a, 1, { burn: true });
  assert.equal(b.hands, 8);
  assert.equal(f.state.control!.primers.length, 1);
});
test('Lawyer defers complete new-status package, moving dismisses at client destination', () => {
  const l = u('l', 'lawyer'),
    v = u('v', 'plain', 0, 'player', 2),
    enemy = u('enemy', 'plain', 0, 'opponent');
  const f = fixture([l, v, enemy]);
  v.silenced = true;
  controlEntrance(f.ctx, l);
  assert.equal(v.silenced, false);
  assert.equal(
    controlDeferStatuses(f.ctx, enemy, v, [
      { kind: 'burn', stacks: 2 },
      { kind: 'silence' },
    ]),
    true,
  );
  assert.equal(v.burnStacks, 0);
  assert.equal(v.silenced, false);
  f.ctx.move(v, 2);
  assert.equal(f.state.control!.appeals.length, 0);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'plain', 2, 2).cost, 1);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'plain', 0, 2).cost, 2);
  f.at(10000);
  assert.equal(v.silenced, false);
  assert.equal(v.burnStacks, 0);
});
test('Lawyer pending cleanse counts with no visible status; dead clients earn no discount', () => {
  const l = u('l', 'lawyer'),
    v = u('v', 'plain', 0, 'player', 2),
    enemy = u('enemy', 'plain', 0, 'opponent');
  const f = fixture([l, v, enemy]);
  controlEntrance(f.ctx, l);
  controlDeferStatuses(f.ctx, enemy, v, [{ kind: 'freeze' }]);
  f.ctx.cleanse(v);
  assert.equal(f.state.control!.discounts.length, 1);
  controlEntrance(f.ctx, l);
  controlDeferStatuses(f.ctx, enemy, v, [{ kind: 'silence' }]);
  v.hands = 0;
  controlCleansed(f.ctx, v);
  assert.equal(f.state.control!.discounts.length, 1);
});
test('Lawyer delayed package applies raw once without spending a newly granted shield', () => {
  const l = u('l', 'lawyer'),
    v = u('v', 'plain', 0, 'player', 2),
    enemy = u('enemy', 'plain', 0, 'opponent');
  const f = fixture([l, v, enemy]);
  controlEntrance(f.ctx, l);
  controlDeferStatuses(f.ctx, enemy, v, [
    { kind: 'burn', stacks: 2 },
    { kind: 'freeze' },
    { kind: 'lock', durationMs: 10000 },
  ]);
  v.protected = true;
  f.at(10000);
  assert.equal(v.burnStacks, 2);
  assert.equal(v.frozen, true);
  assert.equal(v.movementLocks?.length, 1);
  assert.equal(v.protected, true);
  f.at(20000);
  assert.equal(v.burnStacks, 2);
  assert.equal(f.state.control!.appeals.length, 0);
});
test('Father measures net Hands at following interval end, one goal and stable tutoring receipt', () => {
  const dad = u('dad', 'nigerian-father'),
    v = u('v', 'plain', 0, 'player', 2);
  const f = fixture([dad, v]);
  controlEntrance(f.ctx, dad);
  assert.equal(v.hands, 3);
  f.ctx.gain(v, 2);
  f.at(10000);
  assert.equal(v.protected, undefined);
  v.hands--;
  f.at(20000);
  assert.equal(v.protected, undefined);
  assert.equal(v.hands, 4);
  assert.equal(controlEntrance(f.ctx, dad), false);
  v.hands = 0;
  const returned = u('return', 'plain', 0, 'player', 2);
  f.state.units.push(returned);
  assert.equal(controlEntrance(f.ctx, dad), false);
});
test('Father completed net goal gives exactly2 and Protection even if father leaves', () => {
  const dad = u('dad', 'nigerian-father'),
    v = u('v', 'plain', 0, 'player', 2);
  const f = fixture([dad, v]);
  controlEntrance(f.ctx, dad);
  f.ctx.gain(v, 2);
  dad.hands = 0;
  f.at(20000);
  assert.equal(v.hands, 7);
  assert.equal(v.protected, true);
  f.at(30000);
  assert.equal(v.hands, 7);
});
test('Bouncer prioritizes active Ongoing enemy over raw largest; normal movement restrictions apply', () => {
  const b = u('b', 'bouncer'),
    large = u('large', 'plain', 0, 'opponent', 30),
    land = u('land', 'landlord', 0, 'opponent', 3);
  const f = fixture([b, large, land]);
  controlEntrance(f.ctx, b);
  assert.equal(land.lane, 1);
  assert.equal(large.lane, 0);
  land.lane = 0;
  land.silenced = true;
  controlEntrance(f.ctx, b);
  assert.equal(large.lane, 1);
  large.lane = 0;
  large.protected = true;
  controlEntrance(f.ctx, b);
  assert.equal(large.lane, 0);
});
test('Warning checks only legal departure and spends even if shield prevents damage', () => {
  const cop = u('cop', 'rent-a-cop'),
    enemy = u('enemy', 'plain', 0, 'opponent');
  const f = fixture([cop, enemy]);
  controlEntrance(f.ctx, cop);
  f.blocked.add('enemy:1');
  assert.equal(f.ctx.move(enemy, 1), false);
  assert.equal(f.state.control!.warnings.length, 1);
  enemy.protected = true;
  assert.equal(f.ctx.move(enemy, 2), true);
  assert.equal(enemy.hands, 6);
  assert.equal(cop.hands, 2);
  assert.equal(f.state.control!.warnings.length, 0);
});
test('fatal Warning stops one departure without affecting unrelated new paid arrivals', () => {
  const cop = u('cop', 'rent-a-cop'),
    enemy = u('enemy', 'plain', 0, 'opponent', 1);
  const f = fixture([cop, enemy]);
  controlEntrance(f.ctx, cop);
  assert.equal(f.ctx.move(enemy, 1), false);
  assert.equal(enemy.hands, 0);
  assert.equal(enemy.lane, 0);
  assert.equal(cop.hands, 3);
  const next = u('next', 'plain', 1, 'opponent');
  f.enter(next);
  assert.equal(next.hands, 6);
  assert.equal(next.lane, 1);
});
test('Boo decoy survives source silence, but flee reward needs active creator and successful arrival', () => {
  const boo = u('boo', 'boo-boo-the-fool');
  const f = fixture([boo]);
  controlEntrance(f.ctx, boo);
  boo.silenced = true;
  const e = u('e', 'plain', 0, 'opponent');
  f.enter(e);
  assert.equal(e.hands, 5);
  assert.equal(boo.lane, 0);
  assert.equal(boo.hands, 2);
  boo.silenced = false;
  assert.equal(controlEntrance(f.ctx, boo), false);
  boo.hands = 0;
  const returned = u('return', 'boo-boo-the-fool');
  f.state.units.push(returned);
  assert.equal(controlEntrance(f.ctx, returned), false);
  const b = u('b', 'boo-boo-the-fool'),
    f2 = fixture([b]);
  controlEntrance(f2.ctx, b);
  f2.enter(u('e', 'plain', 0, 'opponent'));
  assert.equal(b.lane, 1);
  assert.equal(b.hands, 3);
});
test('Parole Curfew preserves combat and CheckIn is only movement per interval', () => {
  const p = u('p', 'parole-officer'),
    locked = u('lock', 'plain', 0, 'opponent', 10);
  const f = fixture([p, locked]);
  controlEntrance(f.ctx, p);
  assert.equal(locked.frozen, undefined);
  assert.equal(locked.hands, 10);
  assert.equal(f.ctx.openForMove(locked, 1), false);
  const paid = u('paid', 'plain', 0, 'opponent');
  f.enter(paid);
  assert.equal(paid.hands, 6);
  const mover = u('m', 'plain', 1, 'opponent');
  f.state.units.push(mover);
  assert.equal(f.ctx.move(mover, 0), true);
  assert.equal(mover.hands, 4);
  f.ctx.move(mover, 2);
  f.ctx.move(mover, 0);
  assert.equal(mover.hands, 4);
  f.at(10000);
  f.ctx.move(mover, 2);
  f.ctx.move(mover, 0);
  assert.equal(mover.hands, 2);
  f.ctx.cleanse(locked);
  assert.equal(f.ctx.openForMove(locked, 1), true);
});
test('Friend only gains after actual hostile arrival and otherwise protects weak ally', () => {
  const friend = u('f', 'he-just-a-friend'),
    enemy = u('e', 'plain', 0, 'opponent', 10);
  const f = fixture([friend, enemy]);
  f.blocked.add('e:1');
  f.blocked.add('e:2');
  controlEntrance(f.ctx, friend);
  assert.equal(friend.hands, 4);
  f.blocked.delete('e:2');
  controlEntrance(f.ctx, friend);
  assert.equal(enemy.lane, 2);
  assert.equal(friend.hands, 5);
  const ally = u('a', 'plain', 0, 'player', 1);
  f.state.units.push(ally);
  controlEntrance(f.ctx, friend);
  assert.equal(ally.protected, true);
});
test('Ex chase tracks target current lane and only strikes after legal arrival once per identity', () => {
  const ex = u('ex', 'crazy-ex-boyfriend'),
    target = u('target', 'plain', 1, 'opponent', 10);
  const f = fixture([ex, target]);
  controlEntrance(f.ctx, ex);
  f.ctx.move(target, 2);
  f.at(10000);
  assert.equal(ex.lane, 2);
  assert.equal(target.hands, 8);
  assert.equal(controlEntrance(f.ctx, ex), false);
  const ex2 = u('ex2', 'crazy-ex-boyfriend');
  f.state.units.push(ex2);
  assert.equal(controlEntrance(f.ctx, ex2), false);
});
test('Ex illegal or disabled chase never tele-hits, final30seconds is immediate local damage', () => {
  const ex = u('ex', 'crazy-ex-boyfriend'),
    target = u('target', 'plain', 1, 'opponent', 10);
  const f = fixture([ex, target]);
  controlEntrance(f.ctx, ex);
  f.blocked.add('ex:1');
  f.at(10000);
  assert.equal(target.hands, 10);
  f.state.elapsedMs = f.state.durationMs - 30000;
  target.lane = 0;
  controlEntrance(f.ctx, ex);
  assert.equal(target.hands, 8);
  assert.equal(f.state.control!.chases.length, 0);
});
test('UncleSam only gains actual removable bonus, no injury credit; shield blocks everything', () => {
  const sam = u('s', 'uncle-sam'),
    target = u('t', 'plain', 0, 'opponent', 12);
  target.maxHands = 14;
  target.damageTaken = 2;
  const f = fixture([sam, target]);
  controlEntrance(f.ctx, sam);
  assert.equal(target.hands, 6);
  assert.equal(target.maxHands, 8);
  assert.equal(target.damageTaken, 2);
  assert.equal(sam.hands, 12);
  target.protected = true;
  controlEntrance(f.ctx, sam);
  assert.equal(target.hands, 6);
  assert.equal(sam.hands, 12);
  assert.equal(f.state.control!.audits.length, 0);
});
test('Audit stacks with real Landlord tax only on characters and is spent after payment', () => {
  const sam = u('s', 'uncle-sam', 0, 'opponent'),
    land = u('l', 'landlord', 0, 'opponent');
  const f = fixture([sam, land]);
  controlEntrance(f.ctx, sam);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'action', 0, 2).cost, 3);
  const q = controlQuoteCost(f.ctx, 'player', 'plain', 0, 2);
  assert.equal(q.cost, 5);
  assert.equal(f.state.control!.audits.length, 1);
  controlSpendCost(f.ctx, q);
  assert.equal(f.state.control!.audits.length, 0);
  assert.equal(land.hands, 4);
  assert.equal(controlQuoteCost(f.ctx, 'player', 'plain', 0, 2).cost, 2);
});
test('deep-cloned control runtime never aliases nested status batches or source locks', () => {
  const lawyer = u('l', 'lawyer'),
    v = u('v', 'plain', 0, 'player', 1),
    enemy = u('e', 'plain', 0, 'opponent');
  const f = fixture([lawyer, v, enemy]);
  controlEntrance(f.ctx, lawyer);
  controlDeferStatuses(f.ctx, enemy, v, [{ kind: 'burn', stacks: 2 }]);
  const clone = cloneControlState(f.state.control)!;
  clone.appeals[0].pending!.changes[0].stacks = 99;
  clone.appeals[0].source.hands = 999;
  assert.equal(f.state.control!.appeals[0].pending!.changes[0].stacks, 2);
  assert.equal(f.state.control!.appeals[0].source.hands, 3);
  assert.equal(cloneControlState(undefined), undefined);
});

test('Redneck primer belongs to the actual defended recipient after retarget', () => {
  const r = u('r', 'redneck-evil'),
    a = u('a', 'plain', 0, 'opponent', 12),
    b = u('b', 'plain', 0, 'opponent', 10),
    c = u('c', 'plain', 0, 'opponent', 8);
  const f = fixture([r, a, b, c]);
  f.redirects.set(a.id, b);
  controlEntrance(f.ctx, r);
  assert.equal(a.burnStacks, undefined);
  assert.equal(b.burnStacks, 2);
  assert.equal(f.state.control!.primers[0].targetId, b.id);
  f.ctx.rawDamage(r, b, 1, { burn: true });
  assert.equal(c.hands, 6);
});

test('pending support/action status provenance is finite through a JSON replay round trip', () => {
  const l = u('l', 'lawyer'),
    v = u('v', 'plain', 0, 'player', 1),
    actor = u('action', 'plain', 0, 'opponent');
  actor.nextEffectAt = Infinity;
  const f = fixture([l, v]);
  controlEntrance(f.ctx, l);
  controlDeferStatuses(f.ctx, actor, v, [{ kind: 'burn', stacks: 2 }]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(f.state.control)),
    f.state.control,
  );
});
