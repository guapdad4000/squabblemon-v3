import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { catalogCardById } from './src/data';
import {
  advance,
  chooseAi,
  deploy,
  deploymentCost,
  replayCommand,
  createGame,
  type BattleEvent,
  type FighterDefinition,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import { BREAKTHROUGH_ROSTER } from './src/breakthroughCatalog';
import {
  FACTION_ADAPTERS,
  cloneFactionState,
  factionsAfterHostile,
  factionsDiscount,
  factionsEntrance,
  factionsEntranceResolved,
  factionsPlayed,
  factionsPreventMove,
  factionsRedirectHostile,
  factionsSpendDiscount,
  factionsTick,
  type FactionsContext,
} from './src/breakthroughFactions';
const definitions: FighterDefinition[] = [
  ...BREAKTHROUGH_ROSTER.filter(
    (card) => !Object.hasOwn(FACTION_ADAPTERS, card.id),
  ),
  ...Object.entries(FACTION_ADAPTERS).map(([id, adapter]) => {
    const card = catalogCardById[id];
    return {
      id,
      name: card.name,
      art: '',
      cost: card.cost,
      hands: card.power,
      kind: 'character' as const,
      element: card.type,
      faction: card.faction,
      description: '',
      ...adapter,
    } as FighterDefinition;
  }),
];
let identity = 0;
function unit(
  cardId: string,
  side: Side = 'player',
  lane: Lane = 0,
  hands?: number,
): Unit {
  const card =
    definitions.find((card) => card.id === cardId) ?? catalogCardById[cardId];
  assert.ok(card, cardId);
  const base = 'hands' in card ? card.hands : card.power;
  return {
    id: `factions-${++identity}`,
    cardId,
    side,
    lane,
    position: side === 'player' ? 0.1 : 0.9,
    hands: hands ?? base,
    maxHands: hands ?? base,
    baseHands: base,
    squabbled: false,
    arrivalOrder: identity,
    nextEffectAt: 999999,
    ...(cardId.startsWith('blue-side') || cardId === 'triple-og-blue'
      ? { gangColor: 'blue' }
      : {}),
  };
}
function harness(units: Unit[] = [], rolls: number[] = []) {
  const deck = BREAKTHROUGH_ROSTER.filter((card) => card.kind === 'character')
    .slice(0, 10)
    .map((card) => card.id);
  const state = createGame(BREAKTHROUGH_ROSTER, {
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
  state.roster = definitions;
  state.units = units;
  delete state.factions;
  for (const side of ['player', 'opponent'] as const) {
    state.players[side].hand = [];
    state.players[side].queue = [];
    state.players[side].motion = 5;
  }
  let calls = 0;
  const event = (value: Omit<BattleEvent, 'id'>) =>
    state.events.push({ ...value, id: state.nextEventId++ });
  const ctx: FactionsContext = {
    state,
    definition: (target) =>
      definitions.find((card) => card.id === target.cardId) ?? {
        id: target.cardId,
        kind: 'character',
        element: catalogCardById[target.cardId]?.type,
      },
    active: (target) =>
      target.hands > 0 &&
      !target.frozen &&
      !target.silenced &&
      !target.weakened,
    power: (target) => (target.frozen ? 0 : target.hands),
    gain: (target, amount, _copied, source) => {
      target.hands += amount;
      target.maxHands += amount;
      event({
        type: 'buff',
        side: target.side,
        lane: target.lane,
        targetUnitId: target.id,
        amount,
        ...(source ? { sourceUnitId: source.id, sourceSide: source.side } : {}),
        text: `+${amount}`,
      });
    },
    protect: (target) => {
      target.protected = true;
    },
    damage: (source, target, amount) => {
      if (target.immune || ctx.definition(target).cannotLoseHands) return 0;
      if (target.protected) {
        target.protected = false;
        return 0;
      }
      return ctx.selfDamage(source, target, amount);
    },
    selfDamage: (source, target, amount) => {
      if (target.immune || ctx.definition(target).cannotLoseHands) return 0;
      const actual = Math.min(target.hands, amount);
      target.hands -= actual;
      event({
        type: 'damage',
        side: target.side,
        lane: target.lane,
        targetUnitId: target.id,
        sourceUnitId: source.id,
        amount: actual,
        text: `−${actual}`,
      });
      return actual;
    },
    burn: (_source, target, amount) => {
      if (target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      target.burnStacks = (target.burnStacks ?? 0) + amount;
      return true;
    },
    openForMove: (target, lane) =>
      !target.frozen &&
      !(target.movementLocks ?? []).some(
        (lock) => lock.expiresAt > state.elapsedMs,
      ) &&
      target.lane !== lane &&
      !state.units.some(
        (enemy) =>
          enemy.side !== target.side &&
          enemy.lane === lane &&
          enemy.canFight !== false &&
          enemy.hands > 0 &&
          Math.abs(target.position - enemy.position) < 0.22,
      ),
    move: (target, lane) => {
      if (!ctx.openForMove(target, lane)) return false;
      target.lane = lane;
      return true;
    },
    movePair: (a, b, lane) => {
      if (!ctx.openForMove(a, lane) || !ctx.openForMove(b, lane)) return false;
      a.lane = b.lane = lane;
      return true;
    },
    moveEnemy: (source, target, lane, followUp) => {
      if (!ctx.openForMove(target, lane) || target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      if (factionsPreventMove(ctx, target)) return false;
      const moved = ctx.move(target, lane);
      if (moved && followUp?.damage)
        ctx.selfDamage(source, target, followUp.damage);
      if (moved && followUp?.burn)
        target.burnStacks = (target.burnStacks ?? 0) + followUp.burn;
      return moved;
    },
    refund: (side, amount) => {
      const paid = Math.min(amount, 9 - state.players[side].motion);
      state.players[side].motion += paid;
      return paid;
    },
    random: () => rolls[calls++] ?? 0.1,
    event,
  };
  return { ctx, calls: () => calls };
}
function time(ctx: FactionsContext, ms: number) {
  ctx.state.elapsedMs = ms;
  factionsTick(ctx);
}
test('all fifteen adapters are canonical, explicitly classify triggers, and reserve immutable leader flags and lanes', () => {
  assert.equal(Object.keys(FACTION_ADAPTERS).length, 15);
  for (const [id, adapter] of Object.entries(FACTION_ADAPTERS)) {
    assert.ok(catalogCardById[id]);
    assert.ok(adapter.triggers.length);
  }
  assert.equal(FACTION_ADAPTERS['blue-side-1'].cannotLoseHands, true);
  assert.deepEqual(FACTION_ADAPTERS['triple-og-blue'].allowedLanes, [0]);
  assert.equal(FACTION_ADAPTERS['triple-og-blue'].cannotBeSilenced, true);
  assert.deepEqual(FACTION_ADAPTERS['triple-og-red'].allowedLanes, [2]);
});
test('Stud bond intercepts once, protects surviving partner and atomically moves the pair without losing progress', () => {
  const stud = unit('stud'),
    partner = unit('plug'),
    attacker = unit('stockz', 'opponent'),
    { ctx } = harness([stud, partner, attacker]);
  factionsEntrance(ctx, stud);
  const before = partner.hands;
  const redirected = factionsRedirectHostile(ctx, partner);
  assert.equal(redirected.target.id, stud.id);
  assert.ok(redirected.receipt);
  ctx.damage(attacker, redirected.target, 2);
  factionsAfterHostile(ctx, redirected.receipt!);
  assert.equal(partner.hands, before);
  assert.equal(stud.hands, catalogCardById.stud.power - 2);
  assert.equal(stud.lane, partner.lane);
  assert.notEqual(partner.lane, 0);
  assert.equal(partner.protected, true);
  assert.equal(stud.position, 0.1);
  assert.equal(factionsRedirectHostile(ctx, partner).target.id, partner.id);
});
test('Stud cannot partially escape when partner route is blocked, and still Protects after a blocked intercepted hit', () => {
  const stud = unit('stud'),
    partner = unit('plug'),
    { ctx } = harness([stud, partner]);
  factionsEntrance(ctx, stud);
  const redirect = factionsRedirectHostile(ctx, partner);
  stud.protected = true;
  ctx.damage(unit('stockz', 'opponent'), stud, 3);
  const open = ctx.openForMove;
  ctx.openForMove = (unit, lane) => unit.id !== partner.id && open(unit, lane);
  factionsAfterHostile(ctx, redirect.receipt!);
  assert.equal(stud.lane, 0);
  assert.equal(partner.lane, 0);
  assert.equal(partner.protected, true);
});
test('deterministic early interception priority is Stud then Auntie then Fanboy, never a redirect chain', () => {
  const idol = unit('stockz', 'player', 0, 10),
    stud = unit('stud'),
    auntie = unit('bail-bonds-auntie'),
    fan = unit('grown-man-fanboy'),
    { ctx } = harness([idol, stud, auntie, fan]);
  factionsEntrance(ctx, stud); // Weakest is Auntie; bind idol explicitly by temporarily isolating it.
  ctx.state.units = [idol, stud];
  factionsEntrance(ctx, stud);
  ctx.state.units = [idol, auntie];
  factionsEntrance(ctx, auntie);
  ctx.state.units = [idol, fan];
  factionsEntrance(ctx, fan);
  ctx.state.units = [idol, stud, auntie, fan];
  assert.equal(factionsRedirectHostile(ctx, idol).target.id, stud.id);
  assert.equal(factionsRedirectHostile(ctx, idol).target.id, auntie.id);
  assert.equal(factionsRedirectHostile(ctx, idol).target.id, fan.id);
  assert.equal(factionsRedirectHostile(ctx, idol).target.id, idol.id);
});
test('Fanboy takes at most one idol packet each pulse and Fangirl grants +2 only on actual intercepted harm', () => {
  const idol = unit('stockz', 'player', 0, 10),
    fan = unit('grown-man-fanboy'),
    girl = unit('fangirl'),
    { ctx } = harness([idol, fan, girl]);
  factionsEntrance(ctx, fan);
  fan.protected = true;
  const first = factionsRedirectHostile(ctx, idol);
  ctx.damage(unit('stockz', 'opponent'), first.target, 2);
  factionsAfterHostile(ctx, first.receipt!);
  assert.equal(fan.hands, 4);
  assert.equal(factionsRedirectHostile(ctx, idol).target.id, idol.id);
  time(ctx, 10000);
  const second = factionsRedirectHostile(ctx, idol);
  ctx.damage(unit('stockz', 'opponent'), second.target, 1);
  factionsAfterHostile(ctx, second.receipt!);
  assert.equal(fan.hands, 5);
});
test('Asphalt Apostle blocks a forced move only once per side/pulse and gives the actual Earth target +2', () => {
  const apostle = unit('asphalt-apostle'),
    earth = unit('stockz'),
    { ctx } = harness([apostle, earth]);
  const originalDefinition = ctx.definition;
  ctx.definition = (target) =>
    target.id === earth.id
      ? { ...originalDefinition(target), element: 'Earth' }
      : originalDefinition(target);
  assert.equal(factionsPreventMove(ctx, earth), true);
  assert.equal(earth.hands, 6);
  assert.equal(factionsPreventMove(ctx, earth), false);
  time(ctx, 10000);
  assert.equal(factionsPreventMove(ctx, earth), true);
  assert.equal(earth.hands, 8);
});
test('Petey grants discount only after a real legal move; it applies to Red Side metadata and spends atomically once', () => {
  const petey = unit('red-side-1'),
    { ctx } = harness([petey]);
  assert.equal(factionsEntrance(ctx, petey), true);
  assert.equal(petey.lane, 1);
  assert.equal(petey.hands, 3);
  assert.equal(
    factionsDiscount(ctx, 'player', { faction: 'Red Set' }, 2),
    undefined,
  );
  const quote = factionsDiscount(ctx, 'player', { faction: 'Red Side' }, 0)!;
  assert.ok(quote);
  factionsSpendDiscount(
    ctx,
    'player',
    quote.id + 1,
    { faction: 'Red Side' },
    0,
  );
  assert.ok(factionsDiscount(ctx, 'player', { faction: 'Red Side' }, 0));
  factionsSpendDiscount(ctx, 'player', quote.id, { faction: 'Red Side' }, 0);
  assert.equal(
    factionsDiscount(ctx, 'player', { faction: 'Red Side' }, 0),
    undefined,
  );
});
test('Red Night attempts at reveal and two following pulses, never echoes twice in a pulse or taxes allies while enemies remain', () => {
  const night = unit('red-side-2'),
    ally = unit('stockz', 'player', 0, 5),
    enemy = unit('stockz', 'opponent', 0, 9),
    { ctx } = harness([night, ally, enemy]);
  factionsEntrance(ctx, night);
  factionsEntrance(ctx, night, true);
  assert.equal(night.hands, 4);
  assert.equal(enemy.hands, 8);
  time(ctx, 10000);
  time(ctx, 20000);
  time(ctx, 30000);
  assert.equal(night.hands, 6);
  assert.equal(enemy.hands, 6);
  assert.equal(ally.hands, 5);
  const immune = unit('blue-side-1', 'opponent'),
    own = unit('stockz', 'player', 0, 5),
    other = unit('red-side-2'),
    safe = harness([other, own, immune]).ctx;
  factionsEntrance(safe, other);
  assert.equal(own.hands, 5);
  assert.equal(other.hands, 3);
});
test('OG Blue hits another lane, counts exact Blue Side faction and remote Blue Set districts, while immutable loss trait stays authored', () => {
  const blue = unit('blue-side-1'),
    side = unit('blue-side-2', 'player', 1),
    set = unit('plug', 'player', 2),
    enemy = unit('stockz', 'opponent', 2, 8);
  set.gangColor = 'blue';
  const { ctx } = harness([blue, side, set, enemy]);
  factionsEntrance(ctx, blue);
  assert.equal(enemy.hands, 5);
  assert.equal(blue.hands, catalogCardById['blue-side-1'].power + 4);
  blue.silenced = true;
  assert.equal(ctx.damage(enemy, blue, 100), 0);
});
test('lil Blue protects exactly the next other paid character, never an action or a summon', () => {
  const blue = unit('blue-side-2'),
    { ctx } = harness([blue]);
  factionsEntrance(ctx, blue);
  assert.equal(blue.hands, 2);
  factionsPlayed(ctx, 'player', { kind: 'support' }, 2);
  const ally = unit('stockz', 'player', 2);
  ctx.state.units.push(ally);
  factionsPlayed(ctx, 'player', { kind: 'character' }, 2, ally);
  assert.equal(ally.protected, true);
  const next = unit('plug');
  ctx.state.units.push(next);
  factionsPlayed(ctx, 'player', { kind: 'character' }, 0, next);
  assert.notEqual(next.protected, true);
});
test('Blue Scarf snapshots three original riders, moves each at most once to an adjacent lane, and rolls one outcome per route', () => {
  const scarf = unit('blue-side-3'),
    a = unit('plug'),
    b = unit('stockz', 'player', 1),
    c = unit('gamer', 'player', 2),
    { ctx, calls } = harness([scarf, a, b, c], [0.1]);
  factionsEntrance(ctx, scarf);
  assert.deepEqual([a.lane, b.lane, c.lane], [1, 2, 1]);
  assert.equal(a.hands, catalogCardById.plug.power + 1);
  assert.equal(c.hands, catalogCardById.gamer.power + 1);
  assert.equal(calls(), 1);
  factionsEntrance(ctx, scarf, true);
  assert.equal(calls(), 1);
});
test('Blue Scarf steal mode rewards only moved allies whose defended local enemy actually lost a Hand', () => {
  const scarf = unit('blue-side-3'),
    rider = unit('plug'),
    foe = unit('stockz', 'opponent', 1, 8),
    { ctx } = harness([scarf, rider, foe], [0.9]);
  foe.protected = true;
  factionsEntrance(ctx, scarf);
  assert.equal(rider.lane, 1);
  assert.equal(rider.hands, catalogCardById.plug.power);
  assert.equal(foe.hands, 8);
});
test('Blue Triple OG collects blue homage first without taxing them, caps at three and reinforces remote Blue characters', () => {
  const og = unit('triple-og-blue'),
    blue = unit('plug', 'player', 0, 4),
    remote = unit('stockz', 'player', 1, 4),
    donor = unit('gamer', 'player', 2, 5),
    enemy = unit('stockz', 'opponent', 0, 40);
  blue.gangColor = remote.gangColor = 'blue';
  const { ctx } = harness([og, blue, remote, donor, enemy]);
  factionsEntrance(ctx, og);
  assert.equal(og.hands, catalogCardById['triple-og-blue'].power + 3);
  assert.equal(blue.hands, 4);
  assert.equal(remote.hands, 5);
  assert.equal(remote.protected, true);
  assert.equal(donor.hands, 4);
  assert.notEqual(enemy.lane, 0);
  assert.equal(enemy.hands, 39);
});
test('Red Triple OG caps stolen actual Hands at six, hits only three strongest enemies harder, and cannot tax immune fighters', () => {
  const og = unit('triple-og-red', 'player', 2),
    ally = unit('stockz', 'player', 2, 8),
    enemies = [12, 11, 10, 9].map((hands) =>
      unit('stockz', 'opponent', 2, hands),
    ),
    { ctx } = harness([og, ally, ...enemies]);
  factionsEntrance(ctx, og);
  assert.equal(ally.hands, 7);
  assert.deepEqual(
    enemies.map((enemy) => enemy.hands),
    [10, 9, 8, 8],
  );
  assert.equal(og.hands, catalogCardById['triple-og-red'].power + 6);
});
test('Block Spinner applies immediate Burn and leaves one consumed-on-attempt trap for the next enemy paid character', () => {
  const spinner = unit('block-spinner'),
    enemy = unit('stockz', 'opponent'),
    { ctx } = harness([spinner, enemy]);
  factionsEntrance(ctx, spinner);
  assert.equal(enemy.burnStacks, 1);
  factionsPlayed(ctx, 'opponent', { kind: 'support' }, 0);
  const next = unit('plug', 'opponent');
  next.protected = true;
  ctx.state.units.push(next);
  factionsPlayed(ctx, 'opponent', { kind: 'character' }, 0, next);
  assert.equal(next.burnStacks, undefined);
  assert.equal(next.protected, false);
  const third = unit('plug', 'opponent');
  ctx.state.units.push(third);
  factionsPlayed(ctx, 'opponent', { kind: 'character' }, 0, third);
  assert.equal(third.burnStacks, undefined);
});
test('Look Out calls once per pulse and three per match identity; calls reveal a public lane and arm only that lane discount', () => {
  const watcher = unit('look-out'),
    blue = unit('plug', 'player', 1);
  blue.gangColor = 'blue';
  const { ctx } = harness([watcher, blue]);
  factionsEntrance(ctx, watcher);
  for (let index = 0; index < 4; index++) {
    if (index) time(ctx, index * 10000);
    factionsPlayed(ctx, 'opponent', { kind: 'character' }, 2);
    factionsPlayed(ctx, 'opponent', { kind: 'support' }, 2);
  }
  assert.equal(blue.hands, catalogCardById.plug.power + 6);
  assert.ok(factionsDiscount(ctx, 'player', {}, 2));
  assert.equal(factionsDiscount(ctx, 'player', {}, 0), undefined);
  assert.equal(
    ctx.state.events.filter((event) => event.type === 'called-lane').length,
    3,
  );
});
test('dogs approach one adjacent lane per pulse and only support while together with their matching earliest OG', () => {
  const og = unit('triple-og-red', 'player', 2),
    dog = unit('cane-corso-red'),
    foe = unit('stockz', 'opponent', 2, 9),
    { ctx } = harness([og, dog, foe]);
  factionsEntrance(ctx, dog);
  assert.equal(dog.lane, 1);
  assert.equal(foe.hands, 9);
  time(ctx, 10000);
  assert.equal(dog.lane, 2);
  assert.equal(foe.hands, 8);
  time(ctx, 10000);
  assert.equal(foe.hands, 8);
});
test('Blue-Nose backup rewards matching OG and remote Blue Set ally exactly once per pulse', () => {
  const og = unit('triple-og-blue'),
    dog = unit('blue-nose-pit', 'player', 1),
    remote = unit('plug', 'player', 2);
  remote.gangColor = 'blue';
  const { ctx } = harness([og, dog, remote]);
  factionsEntrance(ctx, dog);
  assert.equal(dog.lane, 0);
  assert.equal(og.hands, 9);
  assert.equal(remote.hands, catalogCardById.plug.power + 2);
  factionsEntrance(ctx, dog);
  assert.equal(og.hands, 9);
});
test('dog interception is late, once per pulse, and requires a real legal emergency move rather than teleporting through a blocker', () => {
  const og = unit('triple-og-red', 'player', 2),
    dog = unit('cane-corso-red'),
    { ctx } = harness([og, dog]);
  assert.equal(factionsRedirectHostile(ctx, og, 'early').target.id, og.id);
  const intercept = factionsRedirectHostile(ctx, og, 'dog');
  assert.equal(intercept.target.id, dog.id);
  assert.equal(dog.lane, 2);
  assert.equal(factionsRedirectHostile(ctx, og, 'dog').target.id, og.id);
  time(ctx, 10000);
  dog.lane = 0;
  dog.movementLocks = [{ sourceId: 'locked', expiresAt: 20000 }];
  assert.equal(factionsRedirectHostile(ctx, og, 'dog').target.id, og.id);
  assert.equal(dog.lane, 0);
});
test('Auntie only arms a credit after actual damage/new status, and pays it only for successful remote Poison entrance', () => {
  const auntie = unit('bail-bonds-auntie'),
    partner = unit('plug'),
    { ctx } = harness([auntie, partner]);
  factionsEntrance(ctx, auntie);
  let redirect = factionsRedirectHostile(ctx, partner);
  auntie.protected = true;
  ctx.damage(unit('stockz', 'opponent'), auntie, 2);
  factionsAfterHostile(ctx, redirect.receipt!);
  assert.equal(ctx.state.factions!.seats.player.credit, undefined);
  factionsEntrance(ctx, auntie);
  redirect = factionsRedirectHostile(ctx, partner);
  ctx.damage(unit('stockz', 'opponent'), auntie, 1);
  factionsAfterHostile(ctx, redirect.receipt!);
  assert.ok(ctx.state.factions!.seats.player.credit);
  const poison = unit('bail-bonds-auntie', 'player', 1);
  poison.entranceSucceeded = false;
  ctx.state.units.push(poison);
  factionsEntranceResolved(ctx, poison, 1);
  assert.equal(ctx.state.players.player.motion, 5);
  poison.entranceSucceeded = true;
  factionsEntranceResolved(ctx, poison, 1);
  assert.equal(ctx.state.players.player.motion, 6);
  factionsEntranceResolved(ctx, poison, 1);
  assert.equal(ctx.state.players.player.motion, 6);
});
test('Faction state clones isolate once-per-match receipts, bonds, discounts and nested source metadata', () => {
  const source = unit('stud'),
    partner = unit('plug'),
    { ctx } = harness([source, partner]);
  factionsEntrance(ctx, source);
  const petey = unit('red-side-1');
  ctx.state.units.push(petey);
  factionsEntrance(ctx, petey);
  const before = JSON.stringify(ctx.state.factions),
    clone = cloneFactionState(ctx.state.factions)!;
  clone.seats.player.bonds[0].source.lane = 2;
  clone.seats.player.discounts[0].source.id = 'branch-only';
  clone.seats.player.studSpent['new'] = true;
  assert.equal(JSON.stringify(ctx.state.factions), before);
  assert.equal(cloneFactionState(undefined), undefined);
});

function actualState(units: Unit[] = []) {
  const deck = BREAKTHROUGH_ROSTER.filter((card) => card.kind === 'character')
    .slice(0, 10)
    .map((card) => card.id);
  const state = createGame(BREAKTHROUGH_ROSTER, {
    seed: 21,
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
  state.units = units;
  for (const side of ['player', 'opponent'] as const) {
    state.players[side].hand = [];
    state.players[side].queue = [];
    state.players[side].returns = [];
    state.players[side].motion = 9;
  }
  return state;
}
function actualPlay(
  state: ReturnType<typeof actualState>,
  cardId: string,
  side: Side = 'player',
  lane: Lane = 0,
) {
  state.players[side].hand = [cardId];
  const result = deploy(state, side, cardId, lane);
  assert.equal(result.error, undefined, `${cardId} executes core command`);
  return result.state;
}
test('core leader home-lane restrictions reject atomically and AI quotations never choose an illegal lane', () => {
  for (const side of ['player', 'opponent'] as Side[])
    for (const [id, lane] of [
      ['triple-og-blue', 0],
      ['triple-og-red', 2],
    ] as const) {
      const state = actualState();
      state.players[side].hand = [id];
      const before = JSON.stringify(state);
      const illegal = deploy(state, side, id, 1);
      assert.ok(illegal.error);
      assert.equal(illegal.state, state);
      assert.equal(JSON.stringify(state), before);
      for (let tick = 0; tick < 20; tick++) {
        state.tick = tick;
        const ai = chooseAi(state, side);
        assert.ok(ai);
        assert.equal(ai.lane, lane);
      }
      assert.equal(deploymentCost(state, side, id, 1), Infinity);
      assert.ok(deploymentCost(state, side, id, lane) < Infinity);
    }
});
test('core Stud redirects damage onto the actual interceptor, then escapes/protects its unharmed partner and replays deterministically', () => {
  const partner = unit('plug', 'player', 0, 10);
  let state = actualState([partner]);
  state = actualPlay(state, 'stud');
  const stud = state.units.find((unit) => unit.cardId === 'stud')!,
    beforePartner = state.units.find((unit) => unit.id === partner.id)!.hands;
  state.players.opponent.hand = ['dr-fade'];
  state.players.opponent.motion = 9;
  const result = deploy(state, 'opponent', 'dr-fade', 0);
  assert.equal(result.error, undefined);
  assert.equal(
    result.state.units.find((unit) => unit.id === partner.id)!.hands,
    beforePartner,
  );
  assert.equal(
    result.state.units.find((unit) => unit.id === stud.id)!.hands,
    catalogCardById.stud.power - 2,
  );
  assert.equal(
    result.state.units.find((unit) => unit.id === partner.id)!.protected,
    true,
  );
  assert.deepEqual(replayCommand(state, result.state.commands.at(-1)!), result);
});
test('core Flying Monkeys move+Burn stays one packet on Stud and never leaks its follow-up onto the protected original partner', () => {
  const partner = unit('plug', 'player', 0, 1);
  let state = actualState([partner]);
  state = actualPlay(state, 'stud');
  const stud = state.units.find((unit) => unit.cardId === 'stud')!;
  state = actualPlay(state, 'flying-monkeys', 'opponent');
  assert.equal(state.units.find((unit) => unit.id === stud.id)!.burnStacks, 1);
  assert.equal(
    state.units.find((unit) => unit.id === partner.id)!.burnStacks ?? 0,
    0,
  );
  assert.equal(
    state.units.find((unit) => unit.id === partner.id)!.protected,
    true,
  );
});
test('core Blue immunity to Hands loss survives Silence/Freeze while statuses and movement remain valid targets', () => {
  const blue = unit('blue-side-1', 'player', 0, 9);
  blue.silenced = true;
  let state = actualState([blue]);
  state = actualPlay(state, 'cornball', 'opponent');
  state = advance(state, 6000);
  assert.equal(state.units.find((unit) => unit.id === blue.id)!.hands, 9);
  state.players.opponent.motion = 9;
  state = actualPlay(state, 'snow-bunny', 'opponent');
  assert.equal(state.units.find((unit) => unit.id === blue.id)!.frozen, true);
  assert.equal(state.units.find((unit) => unit.id === blue.id)!.hands, 9);
});
test('core Auntie intercept arms a real credit and the next successful remote Poison entrant receives exactly one refund', () => {
  const partner = unit('plug', 'player', 0, 10);
  let state = actualState([partner]);
  state = actualPlay(state, 'bail-bonds-auntie');
  const auntie = state.units.find(
    (unit) => unit.cardId === 'bail-bonds-auntie',
  )!;
  state = actualPlay(state, 'dr-fade', 'opponent');
  assert.equal(state.units.find((unit) => unit.id === partner.id)!.hands, 10);
  assert.equal(
    state.units.find((unit) => unit.id === auntie.id)!.hands,
    catalogCardById['bail-bonds-auntie'].power - 2,
  );
  assert.ok(state.factions!.seats.player.credit);
  state.players.player.motion = 9;
  const price = deploymentCost(state, 'player', 'mural-apprentice', 1);
  state = actualPlay(state, 'mural-apprentice', 'player', 1);
  assert.equal(state.players.player.motion, 9 - price + 1);
  assert.equal(state.factions!.seats.player.credit, undefined);
});
