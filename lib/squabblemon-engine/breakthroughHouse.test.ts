import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardCatalog, starterRecipes } from './src/data';
import { squabblehouseStaffCardIds } from './src/squabblehouseWave';
import {
  createGame,
  type FighterDefinition,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import {
  HOUSE_ADAPTERS,
  HOUSE_ABILITY_DESCRIPTIONS,
  cloneHouseState,
  houseArrived,
  houseEntrance,
  housePlayed,
  housePreventHostile,
  housePulse,
  houseStopDeparture,
  houseSyncOngoing,
  type HouseContext,
  type HouseMatchState,
} from './src/breakthroughHouse';
const definitions = new Map<string, FighterDefinition>();
for (const card of cardCatalog) {
  const spec = HOUSE_ADAPTERS[card.catalogId as keyof typeof HOUSE_ADAPTERS];
  definitions.set(card.catalogId, {
    id: card.catalogId,
    name: card.name,
    kind: card.kind === 'support' ? 'support' : 'character',
    cost: card.cost,
    hands: card.power,
    art: '',
    description: card.effect,
    ability: (spec?.ability ?? 'none') as FighterDefinition['ability'],
    traits: squabblehouseStaffCardIds.has(card.engineId)
      ? ['squabblehouse']
      : [],
  });
}
function unit(
  id: string,
  cardId: string,
  lane: Lane = 0,
  side: Side = 'player',
  hands?: number,
): Unit {
  const base = definitions.get(cardId)?.hands ?? 3;
  return {
    id,
    cardId,
    lane,
    side,
    hands: hands ?? base,
    maxHands: hands ?? base,
    baseHands: base,
    position: side === 'player' ? 0.3 : 0.7,
    nextEffectAt: 999999,
    squabbled: false,
  };
}
function fixture(units: Unit[] = []) {
  const dummy = Array.from({ length: 10 }, (_, i): FighterDefinition => ({
    id: `dummy${i}`,
    name: 'Dummy',
    cost: 1,
    hands: 2,
    art: '',
    ability: 'none',
    description: '',
  }));
  const state = createGame(dummy) as ReturnType<typeof createGame> & {
    house?: HouseMatchState;
  };
  state.units = units;
  state.roster = [...definitions.values()];
  const blocked = new Set<string>(),
    tokens = new Set<string>(),
    echoCalls: string[] = [];
  const ctx: HouseContext = {
    state,
    definition: (u) =>
      definitions.get(u.cardId) ?? {
        id: u.cardId,
        kind: 'character',
        traits: [],
        ability: 'none',
      },
    active: (u) => u.hands > 0 && !u.frozen && !u.silenced && !u.weakened,
    effectiveHands: (u) => (u.frozen ? 0 : Math.max(0, u.hands)),
    gain(u, n) {
      if (u.hands <= 0) return;
      u.hands += n;
      u.maxHands += n;
      state.events.push({
        id: state.nextEventId++,
        type: 'buff',
        amount: n,
        text: `+${n}`,
      });
    },
    adjustAura(u, n) {
      u.hands += n;
      u.maxHands += n;
    },
    cleanse(u, kinds = ['burn', 'freeze', 'silence', 'weaken']) {
      if (kinds.includes('burn')) u.burnStacks = 0;
      if (kinds.includes('freeze')) u.frozen = false;
      if (kinds.includes('silence')) u.silenced = false;
      if (kinds.includes('weaken')) u.weakened = false;
    },
    openForMove(u, lane) {
      return (
        u.hands > 0 &&
        u.lane !== lane &&
        !u.frozen &&
        !blocked.has(`${u.id}:${lane}`) &&
        !u.movementLocks?.some((x) => x.expiresAt > state.elapsedMs)
      );
    },
    move(u, lane) {
      if (!ctx.openForMove(u, lane) || houseStopDeparture(ctx, u)) return false;
      u.lane = lane;
      houseArrived(ctx, u);
      houseSyncOngoing(ctx);
      return true;
    },
    hostile(source, target, kind, apply) {
      if (target.hands <= 0 || target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      if (housePreventHostile(ctx, target, source.side, kind)) return false;
      apply(target);
      return true;
    },
    strike(source, target, n) {
      let actual = 0;
      ctx.hostile(source, target, 'harm', () => {
        actual = Math.min(n, target.hands);
        target.hands -= actual;
        target.damageTaken = (target.damageTaken ?? 0) + actual;
      });
      return actual;
    },
    griddle(source, target) {
      if (target.immune) return false;
      const burning = (target.burnStacks ?? 0) > 0;
      target.protected = false;
      if (housePreventHostile(ctx, target, source.side, 'harm')) return false;
      const n = Math.min(target.hands, burning ? 5 : 3);
      target.hands -= n;
      target.damageTaken = (target.damageTaken ?? 0) + n;
      if (target.hands > 0)
        target.burnStacks = Math.min(4, (target.burnStacks ?? 0) + 1);
      return n > 0;
    },
    echo(u) {
      echoCalls.push(u.id);
      return houseEntrance(ctx, u, true) === true;
    },
    event(e) {
      state.events.push({ id: state.nextEventId++, ...e });
    },
    isToken: (u) => tokens.has(u.id),
  };
  function enter(u: Unit, echoed = false) {
    if (!state.units.includes(u)) state.units.push(u);
    houseSyncOngoing(ctx);
    if (!echoed) houseArrived(ctx, u);
    const outcome = houseEntrance(ctx, u, echoed);
    if (!echoed) housePlayed(ctx, u);
    houseSyncOngoing(ctx);
    return outcome;
  }
  function time(ms: number) {
    state.elapsedMs = ms;
    housePulse(ctx);
  }
  return { state, ctx, blocked, tokens, echoCalls, enter, time };
}

test('House covers all nine canonical Squabblehouse starter characters, excluding the already-reviewed Side Order action', () => {
  const expected = starterRecipes
    .find((d) => d.id === 'squabblehouse-shift')!
    .catalogCardIds.filter((id) => id !== 'a-side-of-hands');
  assert.equal(expected.length, 9);
  assert.deepEqual(Object.keys(HOUSE_ADAPTERS).sort(), [...expected].sort());
  assert.equal(Object.keys(HOUSE_ABILITY_DESCRIPTIONS).length, 9);
});

test('Manager derives a live staff aura across the board and excludes himself, non-staff names and tokens', () => {
  const manager = unit('manager', 'squabble-house-manager'),
    staff = unit('staff', 'inmate-reformed', 1);
  const fake = unit('Squabblehouse Manager by name', 'hooper', 2),
    token = unit('token', 'squabblehouse-security', 2);
  const f = fixture([manager, staff, fake, token]);
  f.tokens.add(token.id);
  houseSyncOngoing(f.ctx);
  assert.equal(manager.hands, 2);
  assert.equal(manager.maxHands, 2);
  houseSyncOngoing(f.ctx);
  assert.equal(manager.hands, 2);
  staff.hands = 0;
  houseSyncOngoing(f.ctx);
  assert.equal(manager.hands, 1);
  assert.equal(manager.maxHands, 1);
});

test('Manager disable/removal subtracts its aura without healing prior damage or accumulating permanent growth', () => {
  const manager = unit('manager', 'squabble-house-manager', 0, 'player', 5),
    staff = unit('staff', 'inmate-reformed', 1),
    f = fixture([manager, staff]);
  houseSyncOngoing(f.ctx);
  assert.equal(manager.hands, 6);
  manager.hands -= 2;
  manager.damageTaken = 2;
  manager.silenced = true;
  houseSyncOngoing(f.ctx);
  assert.equal(manager.hands, 3);
  assert.equal(manager.damageTaken, 2);
  manager.silenced = false;
  houseSyncOngoing(f.ctx);
  assert.equal(manager.hands, 4);
  assert.equal(manager.damageTaken, 2);
});

test('Manager entrance+1 is separate from its aura and requires an enemy in the current lane', () => {
  const f = fixture([unit('enemy', 'hooper', 0, 'opponent', 10)]),
    manager = unit('manager', 'squabble-house-manager');
  assert.equal(f.enter(manager), true);
  assert.equal(manager.hands, 2);
  assert.equal(f.enter(unit('quiet', 'squabble-house-manager', 2)), false);
});

test('Security arrival check is spent on the first actual enemy arrival; blocked hits give no growth', () => {
  const guard = unit('guard', 'squabblehouse-security'),
    f = fixture([guard]),
    hands = guard.hands;
  const blocked = unit('blocked', 'hooper', 0, 'opponent', 10);
  blocked.protected = true;
  f.state.units.push(blocked);
  houseArrived(f.ctx, blocked);
  assert.equal(blocked.hands, 10);
  assert.equal(guard.hands, hands);
  const next = unit('next', 'hooper', 0, 'opponent', 10);
  f.state.units.push(next);
  houseArrived(f.ctx, next);
  assert.equal(next.hands, 10);
  f.time(10000);
  houseArrived(f.ctx, next);
  assert.equal(next.hands, 9);
  assert.equal(guard.hands, hands + 1);
});

test('Manager and Security have separate arrival checks and recycled identities cannot recharge a spent pulse', () => {
  const guard = unit('guard', 'squabblehouse-security'),
    manager = unit('manager', 'squabble-house-manager'),
    enemy = unit('enemy', 'hooper', 0, 'opponent', 10);
  const f = fixture([guard, manager, enemy]);
  houseArrived(f.ctx, enemy);
  assert.equal(enemy.hands, 8);
  guard.hands = 0;
  manager.hands = 0;
  const g = unit('returned-guard', 'squabblehouse-security'),
    m = unit('returned-manager', 'squabble-house-manager');
  f.state.units.push(g, m);
  houseArrived(f.ctx, enemy);
  assert.equal(enemy.hands, 8);
});

test('Security normal entrance attempts2 actual damage and disabled entrances are inert', () => {
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 10),
    f = fixture([enemy]);
  assert.equal(f.enter(unit('security', 'squabblehouse-security')), true);
  assert.equal(enemy.hands, 8);
  const disabled = unit('disabled', 'squabblehouse-security');
  disabled.weakened = true;
  assert.equal(f.enter(disabled), false);
  assert.equal(enemy.hands, 8);
});

test('Janitor reverses the first real harm against any local ally and grants+2, with copies sharing that lane charge', () => {
  const janitor = unit('a-janitor', 'janitor'),
    copy = unit('z-janitor', 'janitor'),
    ally = unit('ally', 'hooper'),
    enemy = unit('enemy', 'hooper', 0, 'opponent', 20);
  const f = fixture([janitor, copy, ally, enemy]),
    hands = ally.hands;
  assert.equal(f.ctx.strike(enemy, ally, 10), 0);
  assert.equal(ally.hands, hands + 2);
  assert.equal(f.ctx.strike(enemy, ally, 1), 1);
  assert.equal(ally.hands, hands + 1);
  f.time(10000);
  assert.equal(f.ctx.strike(enemy, ally, 1), 0);
  assert.equal(ally.hands, hands + 3);
});

test('Janitor harm and staff-exit charges are independent and staff-exit never protects a non-staff target', () => {
  const janitor = unit('janitor', 'janitor'),
    staff = unit('staff', 'inmate-reformed'),
    ally = unit('ally', 'hooper'),
    f = fixture([janitor, staff, ally]);
  assert.equal(
    housePreventHostile(f.ctx, ally, 'opponent', 'staff-exit'),
    false,
  );
  assert.equal(housePreventHostile(f.ctx, ally, 'opponent', 'harm'), true);
  assert.equal(
    housePreventHostile(f.ctx, staff, 'opponent', 'staff-exit'),
    true,
  );
  assert.equal(
    housePreventHostile(f.ctx, staff, 'opponent', 'staff-exit'),
    false,
  );
  assert.equal(housePreventHostile(f.ctx, staff, 'player', 'harm'), false);
  assert.equal(
    housePreventHostile(f.ctx, staff, 'opponent', 'departure-stop'),
    false,
  );
});

test('Immunity and personal Protection block before Janitor, preserving both reversal charges', () => {
  const janitor = unit('janitor', 'janitor'),
    ally = unit('ally', 'hooper'),
    enemy = unit('enemy', 'hooper', 0, 'opponent', 20),
    f = fixture([janitor, ally, enemy]);
  ally.immune = true;
  f.ctx.strike(enemy, ally, 1);
  assert.equal(f.state.house?.janitorCharges['player:0:harm'], undefined);
  ally.immune = false;
  ally.protected = true;
  f.ctx.strike(enemy, ally, 1);
  assert.equal(f.state.house?.janitorCharges['player:0:harm'], undefined);
  assert.equal(f.ctx.strike(enemy, ally, 1), 0);
  assert.equal(ally.hands, 6);
});

test('disabled Janitors cannot reverse, distant Janitors cannot reverse and damage death uses the harm charge', () => {
  const janitor = unit('janitor', 'janitor', 1),
    target = unit('target', 'inmate-reformed', 0, 'player', 1),
    enemy = unit('enemy', 'hooper', 0, 'opponent', 20);
  const f = fixture([janitor, target, enemy]);
  janitor.lane = 0;
  janitor.silenced = true;
  assert.equal(housePreventHostile(f.ctx, target, 'opponent', 'harm'), false);
  janitor.silenced = false;
  janitor.lane = 1;
  assert.equal(housePreventHostile(f.ctx, target, 'opponent', 'harm'), false);
  janitor.lane = 0;
  assert.equal(f.ctx.strike(enemy, target, 20), 0);
  assert.equal(target.hands, 3);
  assert.equal(f.state.house!.janitorCharges['player:0:staff-exit'], undefined);
});

test('Cashier applies a defended source-owned Lock plus an independent Tab even when the Lock is blocked', () => {
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 10);
  enemy.protected = true;
  const cashier = unit('cashier', 'squabblehouse-cashier'),
    f = fixture([enemy]);
  assert.equal(f.enter(cashier), true);
  assert.equal(enemy.movementLocks, undefined);
  assert.equal(f.state.house!.tabs.length, 1);
  f.time(5000);
  assert.equal(houseEntrance(f.ctx, cashier, true), true);
  assert.equal(enemy.movementLocks![0].expiresAt, 20000);
  assert.equal(f.ctx.openForMove(enemy, 1), false);
});
test('Open Tab does not spend on arrivals or impossible exits, blocks one otherwise-legal departure per pulse, and outlives its Cashier', () => {
  const cashier = unit('cashier', 'squabblehouse-cashier'),
    f = fixture();
  f.enter(cashier);
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 10);
  f.state.units.push(enemy);
  houseArrived(f.ctx, enemy);
  assert.equal(f.state.house!.tabs[0].spentPulse, -1);
  f.blocked.add('enemy:1');
  assert.equal(f.ctx.move(enemy, 1), false);
  assert.equal(f.state.house!.tabs[0].spentPulse, -1);
  cashier.hands = 0;
  f.blocked.clear();
  assert.equal(f.ctx.move(enemy, 1), false);
  assert.equal(enemy.lane, 0);
  assert.equal(f.ctx.move(enemy, 1), true);
  assert.equal(enemy.lane, 1);
  enemy.lane = 0;
  f.time(10000);
  assert.equal(f.ctx.move(enemy, 1), false);
  f.time(20000);
  assert.equal(f.ctx.move(enemy, 1), true);
});

test('Cashier repeats extend expiry while preserving spent pulse and independently-owned movement Locks', () => {
  const cashier = unit('cashier', 'squabblehouse-cashier'),
    f = fixture();
  f.enter(cashier);
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 10);
  f.state.units.push(enemy);
  assert.equal(houseStopDeparture(f.ctx, enemy), true);
  f.time(5000);
  houseEntrance(f.ctx, cashier, true);
  assert.equal(f.state.house!.tabs[0].spentPulse, 0);
  f.time(15000);
  houseEntrance(f.ctx, cashier, true);
  assert.equal(f.state.house!.tabs[0].expiresAt, 30000);
  enemy.movementLocks!.push({ sourceId: 'other-contract', expiresAt: 50000 });
  f.time(30000);
  assert.deepEqual(
    enemy.movementLocks!.map((x) => x.sourceId),
    ['other-contract'],
  );
});

test('Protection can defeat Open Tab without recharging any other ability or spending Janitor staff-exit', () => {
  const f = fixture();
  f.enter(unit('cashier', 'squabblehouse-cashier'));
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 10);
  enemy.protected = true;
  f.state.units.push(enemy);
  assert.equal(houseStopDeparture(f.ctx, enemy), false);
  assert.equal(enemy.protected, false);
  assert.equal(f.state.house!.tabs[0].spentPulse, -1);
});

test('Griddle strips personal Protection, deals3 or5 if burning, and adds1 Burn as one defended package', () => {
  for (const burning of [false, true]) {
    const enemy = unit('enemy', 'hooper', 0, 'opponent', 10);
    enemy.protected = true;
    enemy.burnStacks = burning ? 1 : 0;
    const f = fixture([enemy]);
    assert.equal(f.enter(unit('griddle', 'griddle-master')), true);
    assert.equal(enemy.hands, burning ? 5 : 7);
    assert.equal(enemy.protected, false);
    assert.equal(enemy.burnStacks, burning ? 2 : 1);
  }
});

test('Griddle honors immunity and Janitor can reverse the whole damage/Burn package', () => {
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 10);
  enemy.immune = true;
  const f = fixture([enemy]);
  assert.equal(f.enter(unit('griddle', 'griddle-master')), false);
  assert.equal(enemy.hands, 10);
  enemy.immune = false;
  f.state.units.push(unit('janitor', 'janitor', 0, 'opponent', 10));
  assert.equal(f.enter(unit('griddle2', 'griddle-master')), false);
  assert.equal(enemy.hands, 12);
  assert.equal(enemy.burnStacks, undefined);
});

test('Inmate Reformed gains2 from semantic local staff independently of whether the hostile hit is blocked', () => {
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 10);
  enemy.protected = true;
  const staff = unit('staff', 'waffle-warlord'),
    inmate = unit('inmate', 'inmate-reformed'),
    f = fixture([enemy, staff]);
  const hands = inmate.hands;
  assert.equal(f.enter(inmate), true);
  assert.equal(inmate.hands, hands + 2);
  assert.equal(enemy.hands, 10);
});

test('Bus Boy reveal uses the true weakest other lane, grants1 only after arrival and never routes around a blocked canonical destination', () => {
  const passenger = unit('passenger', 'inmate-reformed'),
    bus = unit('bus', 'squabblehouse-bus-boy'),
    f = fixture([passenger]);
  f.blocked.add('passenger:1');
  assert.equal(f.enter(bus), false);
  assert.equal(passenger.lane, 0);
  assert.equal(passenger.hands, 3);
  f.blocked.clear();
  assert.equal(houseEntrance(f.ctx, bus), true);
  assert.equal(passenger.lane, 1);
  assert.equal(passenger.hands, 4);
});

test('Bus Boy patrol moves adjacently with edge reversal and cleanses only Weaken at its successful destination', () => {
  const bus = unit('bus', 'squabblehouse-bus-boy'),
    ally = unit('ally', 'hooper', 1);
  ally.weakened = true;
  ally.silenced = true;
  const f = fixture([bus, ally]);
  houseSyncOngoing(f.ctx);
  f.time(10000);
  assert.equal(bus.lane, 1);
  assert.equal(ally.weakened, false);
  assert.equal(ally.silenced, true);
  assert.equal(ally.hands, 5);
  f.time(20000);
  assert.equal(bus.lane, 2);
  f.time(30000);
  assert.equal(bus.lane, 1);
});

test('failed Bus Boy patrol consumes that attempt without fallback or cleanse, while disabled patrols remain still', () => {
  const bus = unit('bus', 'squabblehouse-bus-boy'),
    ally = unit('ally', 'hooper', 1);
  ally.weakened = true;
  const f = fixture([bus, ally]);
  houseSyncOngoing(f.ctx);
  f.blocked.add('bus:1');
  f.time(10000);
  assert.equal(bus.lane, 0);
  assert.equal(ally.weakened, true);
  f.blocked.clear();
  f.time(10000);
  assert.equal(bus.lane, 0);
  bus.silenced = true;
  f.time(20000);
  assert.equal(bus.lane, 0);
  bus.silenced = false;
  f.time(30000);
  assert.equal(bus.lane, 1);
  assert.equal(ally.weakened, false);
});

test('Warlord uses all3 staffed lanes for2-Hand gifts, excludes itself, and uses semantic staff only', () => {
  const a = unit('a', 'janitor'),
    b = unit('b', 'inmate-reformed', 1),
    fake = unit('Squabblehouse Staff', 'hooper', 2);
  const lord = unit('lord', 'waffle-warlord', 2),
    f = fixture([a, b, fake]),
    hands = [a.hands, b.hands, lord.hands];
  assert.equal(f.enter(lord), true);
  assert.equal(a.hands, hands[0] + 2);
  assert.equal(b.hands, hands[1] + 2);
  assert.equal(lord.hands, hands[2]);
  assert.equal(fake.hands, 4);
});

test('Teknician repeats latest living active eligible staff instead of ongoing-only Janitor or another Teknician', () => {
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 20),
    f = fixture([enemy]);
  const inmate = unit('inmate', 'inmate-reformed');
  f.enter(inmate);
  assert.equal(enemy.hands, 19);
  f.enter(unit('janitor', 'janitor', 2));
  assert.equal(f.enter(unit('tech', 'squabblehouse-teknician', 0)), true);
  assert.deepEqual(f.echoCalls, ['inmate']);
  assert.equal(enemy.hands, 18);
  assert.equal(
    houseEntrance(
      f.ctx,
      f.state.units.find((u) => u.id === 'tech')!,
      true,
    ),
    false,
  );
});

test('Teknician paid-staff trigger is once per pulse, and echoes create no new paid arrival/history', () => {
  const tech = unit('tech', 'squabblehouse-teknician'),
    f = fixture([tech]);
  f.enter(unit('cashier', 'squabblehouse-cashier'));
  assert.deepEqual(f.echoCalls, ['cashier']);
  const history = [...f.state.house!.history];
  assert.deepEqual(history, ['cashier']);
  f.enter(unit('inmate', 'inmate-reformed'));
  assert.deepEqual(f.echoCalls, ['cashier']);
  f.time(10000);
  f.enter(unit('war', 'waffle-warlord'));
  assert.deepEqual(f.echoCalls, ['cashier', 'war']);
});

test('Teknician cannot repeat disabled or absent staff and no eligible history means no invented success', () => {
  const f = fixture(),
    staff = unit('staff', 'inmate-reformed');
  f.enter(staff);
  staff.silenced = true;
  assert.equal(f.enter(unit('tech', 'squabblehouse-teknician')), false);
  assert.deepEqual(f.echoCalls, []);
  staff.silenced = false;
  staff.hands = 0;
  assert.equal(f.enter(unit('copy', 'squabblehouse-teknician')), false);
});

test('House state clones all histories, aura/charge ledgers, patrol directions and Open Tab source snapshots independently', () => {
  const bus = unit('bus', 'squabblehouse-bus-boy'),
    f = fixture([bus]);
  f.enter(unit('cashier', 'squabblehouse-cashier'));
  f.time(10000);
  const original = f.state.house!,
    serialized = JSON.stringify(original),
    copy = cloneHouseState(original)!;
  copy.history.push('fake');
  copy.arrivalChecks.fake = 99;
  copy.tekRevealPulse.fake = 99;
  copy.tekPlayedPulse.fake = 99;
  copy.janitorCharges.fake = 99;
  copy.patrols.bus.direction = -1;
  copy.managerAuras.fake = 99;
  copy.tabs[0].source.hands = 99;
  copy.tabs[0].spentPulse = 99;
  assert.equal(JSON.stringify(original), serialized);
  assert.deepEqual(cloneHouseState(JSON.parse(serialized)), original);
  assert.equal(cloneHouseState(undefined), undefined);
});
