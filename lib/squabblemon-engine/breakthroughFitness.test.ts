import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardCatalog, starterRecipes } from './src/data';
import { FITNESS_CHARACTER_IDS } from './src/musicIndustryWave';
import {
  createGame,
  type FighterDefinition,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import {
  FITNESS_ADAPTERS,
  FITNESS_ABILITY_DESCRIPTIONS,
  captureFitnessBoard,
  cloneFitnessState,
  fitnessAfterBoardChange,
  fitnessEnemyDamage,
  fitnessEntrance,
  fitnessMoved,
  fitnessPlayed,
  fitnessPulse,
  type FitnessContext,
  type FitnessMatchState,
} from './src/breakthroughFitness';
const canonicalFitness = new Set(FITNESS_CHARACTER_IDS);
const definitions = new Map<string, FighterDefinition>();
for (const card of cardCatalog) {
  const adapter =
    FITNESS_ADAPTERS[card.catalogId as keyof typeof FITNESS_ADAPTERS];
  definitions.set(card.catalogId, {
    id: card.catalogId,
    name: card.name,
    kind: card.kind === 'support' ? 'support' : 'character',
    cost: card.cost,
    hands: card.power,
    art: '',
    description: card.effect,
    ability: (adapter?.ability ?? 'none') as FighterDefinition['ability'],
    traits: canonicalFitness.has(card.engineId) ? ['fitness'] : [],
  });
}
const defaultUnit = (
  id: string,
  cardId: string,
  lane: Lane = 0,
  side: Side = 'player',
  hands?: number,
): Unit => {
  const base = definitions.get(cardId)?.hands ?? 3;
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
    deployedAt: 0,
  };
};
function fixture(initial: Unit[] = []) {
  const dummy = Array.from({ length: 10 }, (_, i): FighterDefinition => ({
    id: `d${i}`,
    name: `D${i}`,
    cost: 1,
    hands: 2,
    art: '',
    description: '',
    ability: 'none',
  }));
  const state = createGame(dummy) as ReturnType<typeof createGame> & {
    fitness?: FitnessMatchState;
  };
  state.units = initial;
  state.roster = [...definitions.values()];
  state.players.player.hand = [];
  state.players.opponent.hand = [];
  const blocked = new Set<string>(),
    tokens = new Set<string>(),
    absorbed = new Set<string>();
  const ctx: FitnessContext = {
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
        side: u.side,
        lane: u.lane,
        amount: n,
        text: `+${n}`,
      });
    },
    protect(u) {
      u.protected = true;
    },
    cleanse(u, kinds = ['burn', 'freeze', 'silence', 'weaken']) {
      if (kinds.includes('burn')) u.burnStacks = 0;
      if (kinds.includes('freeze')) u.frozen = false;
      if (kinds.includes('silence')) u.silenced = false;
      if (kinds.includes('weaken')) u.weakened = false;
    },
    heal(u, cap) {
      const n = Math.min(
        cap,
        u.damageTaken ?? 0,
        Math.max(0, u.maxHands - u.hands),
      );
      u.hands += n;
      u.damageTaken = (u.damageTaken ?? 0) - n;
      return n;
    },
    clearMovementRestriction(u) {
      u.movementLocks = [];
    },
    openForMove(u, lane) {
      return (
        u.lane !== lane &&
        !u.frozen &&
        !u.movementLocks?.some((x) => x.expiresAt > state.elapsedMs) &&
        !blocked.has(`${u.id}:${lane}`)
      );
    },
    move(u, lane) {
      if (!ctx.openForMove(u, lane)) return false;
      const before = captureFitnessBoard(ctx),
        old = u.lane;
      u.lane = lane;
      fitnessMoved(ctx, u, old);
      fitnessAfterBoardChange(ctx, u, before);
      return true;
    },
    strike(source, target, n) {
      if (target.immune || absorbed.has(target.id)) return 0;
      if (target.protected) {
        target.protected = false;
        return 0;
      }
      const actual = Math.min(n, Math.max(0, target.hands));
      target.hands -= actual;
      target.damageTaken = (target.damageTaken ?? 0) + actual;
      fitnessEnemyDamage(ctx, source.side, target, actual);
      fitnessAfterBoardChange(ctx);
      return actual;
    },
    event(e) {
      state.events.push({ id: state.nextEventId++, ...e });
    },
    isToken: (u) => tokens.has(u.id),
  };
  function enter(u: Unit, paid = true) {
    const before = captureFitnessBoard(ctx);
    if (!state.units.includes(u)) state.units.push(u);
    if (paid) fitnessPlayed(ctx, u);
    const result = fitnessEntrance(ctx, u);
    fitnessAfterBoardChange(ctx, u, before);
    return result;
  }
  function time(ms: number) {
    state.elapsedMs = ms;
    fitnessPulse(ctx);
    fitnessAfterBoardChange(ctx);
  }
  return { ctx, state, blocked, tokens, absorbed, enter, time };
}

test('Fitness adapters cover both complete canonical starter-deck families with17 real reviewed abilities', () => {
  const ids = new Set(
    starterRecipes
      .filter((d) => ['fitness-circuit', 'fitness-routes'].includes(d.id))
      .flatMap((d) => d.catalogCardIds)
      .filter((id) => id !== 'hooper'),
  );
  assert.equal(ids.size, 17);
  assert.deepEqual(Object.keys(FITNESS_ADAPTERS).sort(), [...ids].sort());
  assert.equal(Object.keys(FITNESS_ABILITY_DESCRIPTIONS).length, 17);
  for (const spec of Object.values(FITNESS_ADAPTERS))
    assert.ok(FITNESS_ABILITY_DESCRIPTIONS[spec.ability]);
});

test('Track Suit Auntie chooses the weakest legal other lane, preserves progress, and does not wait for FX', () => {
  const u = defaultUnit('a', 'track-suit-auntie'),
    f = fixture([defaultUnit('strong', 'hooper', 1, 'player', 9)]);
  const progress = u.position;
  assert.equal(f.enter(u), true);
  assert.equal(u.lane, 2);
  assert.equal(u.position, progress);
  assert.deepEqual(f.state.fitness!.routes[u.id], [0, 2]);
  const blocked = defaultUnit('blocked', 'track-suit-auntie');
  f.blocked.add('blocked:1');
  f.blocked.add('blocked:2');
  assert.equal(f.enter(blocked), false);
  assert.equal(blocked.lane, 0);
});

test('disabled Fitness entrances do nothing, and ordinary names do not confer the Fitness trait', () => {
  for (const flag of ['frozen', 'silenced', 'weakened'] as const) {
    const u = defaultUnit(flag, 'track-suit-auntie');
    u[flag] = true;
    const f = fixture();
    assert.equal(f.enter(u), false);
    assert.equal(u.lane, 0);
  }
  const fake = defaultUnit(
    'Fitness Athlete by name',
    'cornball',
    0,
    'player',
    1,
  );
  const bag = defaultUnit('bag', 'gym-bag-yn'),
    f = fixture([fake]);
  assert.equal(f.enter(bag), false);
  assert.equal(fake.lane, 0);
});

test('Bag Check moves only the weakest local Fitness ally and shares one successful payout across copies per pulse', () => {
  const a = defaultUnit('a', 'hooper', 0, 'player', 2),
    b = defaultUnit('b', 'fitness-bro', 0, 'player', 4);
  const f = fixture([a, b]);
  assert.equal(f.enter(defaultUnit('bag1', 'gym-bag-yn')), true);
  assert.equal(a.lane, 1);
  assert.equal(f.enter(defaultUnit('bag2', 'gym-bag-yn')), false);
  assert.equal(b.lane, 0);
  f.time(10000);
  assert.equal(f.enter(defaultUnit('bag3', 'gym-bag-yn')), true);
  assert.notEqual(f.state.units.find((u) => u.id === 'bag1')!.lane, 0);
  assert.equal(b.lane, 0);
});

test('failed Bag Check does not spend the shared pulse and cannot skip its weakest frozen ally', () => {
  const a = defaultUnit('a', 'hooper', 0, 'player', 2);
  a.frozen = true;
  const f = fixture([a]);
  assert.equal(f.enter(defaultUnit('bag1', 'gym-bag-yn')), false);
  a.frozen = false;
  assert.equal(f.enter(defaultUnit('bag2', 'gym-bag-yn')), true);
});

test('Stairwell Sprinter visits unvisited legal lanes and only its first successful entrance move earns+1', () => {
  const u = defaultUnit('s', 'stairwell-sprinter'),
    f = fixture();
  const hands = u.hands;
  assert.equal(f.enter(u), true);
  assert.equal(u.lane, 1);
  assert.equal(u.hands, hands + 1);
  assert.equal(fitnessEntrance(f.ctx, u), true);
  assert.equal(u.lane, 2);
  assert.equal(u.hands, hands + 1);
  assert.equal(fitnessEntrance(f.ctx, u), false);
  assert.deepEqual(f.state.fitness!.routes[u.id], [0, 1, 2]);
});

test('Last Set OG rewards a living completed route in every occupied Fitness lane once per side', () => {
  const runner = defaultUnit('runner', 'stairwell-sprinter'),
    other = defaultUnit('other', 'fitness-bro', 1);
  const f = fixture([runner, other]);
  fitnessPlayed(f.ctx, runner);
  f.ctx.move(runner, 1);
  f.ctx.move(runner, 2);
  const boss = defaultUnit('boss', 'last-set-og');
  const before = [runner.hands, other.hands, boss.hands];
  assert.equal(f.enter(boss), true);
  assert.deepEqual(
    [runner.hands, other.hands, boss.hands],
    before.map((n) => n + 2),
  );
  const again = defaultUnit('again', 'last-set-og');
  assert.equal(f.enter(again), false);
});

test('Last Set fallback protects another local athlete without spending the future circuit finish', () => {
  const u = defaultUnit('u', 'hooper'),
    f = fixture([u]);
  assert.equal(f.enter(defaultUnit('last', 'last-set-og')), true);
  assert.equal(u.protected, true);
  assert.equal(f.state.fitness!.seats.player.finishUsed, false);
  u.hands = 0;
  assert.equal(f.enter(defaultUnit('empty', 'last-set-og', 2)), false);
});

test('Spotter ward persists after its source leaves and pays once on movement through the next interval', () => {
  const u = defaultUnit('u', 'hooper'),
    spotter = defaultUnit('spotter', 'gym-spotter-yn');
  const f = fixture([u]);
  f.enter(spotter);
  const hands = u.hands;
  assert.equal(u.protected, true);
  assert.equal(f.state.fitness!.wards.length, 1);
  spotter.hands = 0;
  f.time(15000);
  f.ctx.move(u, 1);
  assert.equal(u.hands, hands + 1);
  f.ctx.move(u, 0);
  assert.equal(u.hands, hands + 1);
  assert.equal(f.state.fitness!.wards.length, 0);
});

test('Spotter ward expires exactly at its deadline and frozen failed moves do not consume it', () => {
  const u = defaultUnit('u', 'hooper'),
    f = fixture([u]);
  f.enter(defaultUnit('spotter', 'gym-spotter-yn'));
  const hands = u.hands;
  u.frozen = true;
  assert.equal(f.ctx.move(u, 1), false);
  assert.equal(f.state.fitness!.wards.length, 1);
  u.frozen = false;
  f.time(20000);
  f.ctx.move(u, 1);
  assert.equal(u.hands, hands);
});

test('Bodyweight pays only its own first successful active move per pulse and stops after two per instance', () => {
  const u = defaultUnit('u', 'calisthenics-yn'),
    f = fixture([u]);
  const start = u.hands;
  fitnessPlayed(f.ctx, u);
  f.ctx.move(u, 1);
  assert.equal(u.hands, start + 2);
  f.ctx.move(u, 2);
  assert.equal(u.hands, start + 2);
  f.time(10000);
  u.silenced = true;
  f.ctx.move(u, 1);
  assert.equal(u.hands, start + 2);
  u.silenced = false;
  f.ctx.move(u, 0);
  assert.equal(u.hands, start + 4);
  f.time(20000);
  f.ctx.move(u, 1);
  assert.equal(u.hands, start + 4);
});

test('held OG rewards only Fitness movement once per pulse twice per side across held copies', () => {
  const u = defaultUnit('u', 'hooper'),
    fake = defaultUnit('fake', 'cornball'),
    f = fixture([u, fake]);
  f.state.players.player.hand = ['og-calisthenics'];
  const start = u.hands;
  f.ctx.move(fake, 1);
  assert.equal(fake.hands, definitions.get('cornball')!.hands);
  f.ctx.move(u, 1);
  f.ctx.move(u, 2);
  assert.equal(u.hands, start + 1);
  f.time(10000);
  f.ctx.move(u, 1);
  assert.equal(u.hands, start + 2);
  f.time(20000);
  f.ctx.move(u, 0);
  assert.equal(u.hands, start + 2);
  assert.equal(
    f.state.events.find(
      (e) => e.type === 'buff' && e.sourceUnitId?.startsWith('hand:'),
    )?.sourceSide,
    'player',
  );
});

test('OG Calisthenics entrance buffs the weakest Fitness ally in every lane, once per side', () => {
  const a = defaultUnit('a', 'hooper', 0),
    b = defaultUnit('b', 'fitness-bro', 1),
    c = defaultUnit('c', 'fitness-girl', 2);
  const f = fixture([a, b, c]);
  const before = [a.hands, b.hands, c.hands];
  assert.equal(
    f.enter(defaultUnit('og', 'og-calisthenics', 0, 'player', 9)),
    true,
  );
  assert.deepEqual(
    [a.hands, b.hands, c.hands],
    before.map((n) => n + 3),
  );
  assert.equal(f.enter(defaultUnit('copy', 'og-calisthenics')), false);
});

test('OG fallback protects only another local Fitness ally and failed entrance does not spend the finisher', () => {
  const f = fixture();
  assert.equal(f.enter(defaultUnit('empty', 'og-calisthenics')), false);
  const ally = defaultUnit('ally', 'hooper');
  f.state.units.push(ally);
  const hands = ally.hands;
  assert.equal(
    f.enter(defaultUnit('og', 'og-calisthenics', 0, 'player', 9)),
    true,
  );
  assert.equal(ally.hands, hands + 3);
  assert.equal(ally.protected, true);
});

test('Double Dutch pays its active source for the first two distinct Fitness movers and shares both match caps', () => {
  const a = defaultUnit('a', 'hooper'),
    b = defaultUnit('b', 'fitness-girl'),
    rope = defaultUnit('rope', 'jump-rope-menace');
  const copy = defaultUnit('z-copy', 'jump-rope-menace'),
    f = fixture([a, b, rope, copy]);
  const start = rope.hands;
  f.ctx.move(a, 1);
  assert.equal(rope.hands, start + 2);
  assert.equal(a.hands, definitions.get('hooper')!.hands);
  f.ctx.move(a, 2);
  assert.equal(rope.hands, start + 2);
  f.ctx.move(b, 1);
  assert.equal(rope.hands, start + 3);
  assert.equal(copy.hands, 3);
  f.time(10000);
  f.ctx.move(a, 0);
  f.ctx.move(b, 0);
  assert.equal(rope.hands, start + 6);
  f.time(20000);
  f.ctx.move(a, 1);
  f.ctx.move(b, 1);
  assert.equal(rope.hands, start + 6);
});

test('ATV Lord preflights both movers and buffs/protects only a passenger who actually arrives', () => {
  const passenger = defaultUnit('p', 'cornball'),
    rider = defaultUnit('r', 'yn-atv-lord'),
    f = fixture([passenger]);
  f.blocked.add('p:1');
  f.blocked.add('p:2');
  assert.equal(f.enter(rider), false);
  assert.equal(rider.lane, 0);
  assert.equal(passenger.lane, 0);
  f.blocked.clear();
  const hands = passenger.hands;
  assert.equal(fitnessEntrance(f.ctx, rider), true);
  assert.equal(rider.lane, 1);
  assert.equal(passenger.lane, 1);
  assert.equal(passenger.hands, hands + 1);
  assert.equal(passenger.protected, true);
});

test('Maintenance Sage cleanses first, clears source movement locks and protects only after a legal arrival', () => {
  const target = defaultUnit('t', 'hooper'),
    f = fixture([target]);
  target.frozen = true;
  target.silenced = true;
  target.weakened = true;
  target.burnStacks = 3;
  target.movementLocks = [{ sourceId: 'manager', expiresAt: 20000 }];
  f.enter(defaultUnit('sage', 'apartment-maintenance-sage'));
  assert.equal(target.frozen, false);
  assert.equal(target.silenced, false);
  assert.equal(target.weakened, false);
  assert.equal(target.burnStacks, 0);
  assert.deepEqual(target.movementLocks, []);
  assert.equal(target.lane, 1);
  assert.equal(target.protected, true);
  const blocked = defaultUnit('b', 'hooper'),
    g = fixture([blocked]);
  g.blocked.add('b:1');
  g.blocked.add('b:2');
  blocked.burnStacks = 1;
  g.enter(defaultUnit('sage', 'apartment-maintenance-sage'));
  assert.equal(blocked.burnStacks, 0);
  assert.equal(blocked.lane, 0);
  assert.equal(blocked.protected, undefined);
});

test('Lash Out requires actual damage and never pays on immunity, Protection or complete absorption', () => {
  for (const defense of ['immune', 'protected', 'absorbed', 'none']) {
    const ally = defaultUnit('ally', 'cornball'),
      enemy = defaultUnit('enemy', 'hooper', 0, 'opponent', 8);
    const f = fixture([ally, enemy]);
    if (defense === 'immune') enemy.immune = true;
    if (defense === 'protected') enemy.protected = true;
    if (defense === 'absorbed') f.absorbed.add(enemy.id);
    const hands = ally.hands;
    assert.equal(f.enter(defaultUnit('lash', 'lash-tech')), defense === 'none');
    assert.equal(ally.hands, hands + (defense === 'none' ? 2 : 0));
    assert.equal(enemy.hands, defense === 'none' ? 7 : 8);
  }
});

test('Fitness Bro requires a later real paid character in a different lane and pays at the pulse boundary', () => {
  const bro = defaultUnit('bro', 'fitness-bro'),
    f = fixture();
  f.enter(bro);
  const hands = bro.hands;
  const same = defaultUnit('same', 'cornball');
  f.enter(same);
  f.time(10000);
  assert.equal(bro.hands, hands);
  const moveOnly = defaultUnit('move-only', 'hooper');
  f.state.units.push(moveOnly);
  f.ctx.move(moveOnly, 1);
  f.time(20000);
  assert.equal(bro.hands, hands);
  f.enter(defaultUnit('paid', 'cornball', 1));
  assert.equal(bro.hands, hands);
  f.time(29999);
  assert.equal(bro.hands, hands);
  f.time(30000);
  assert.equal(bro.hands, hands + 3);
  assert.equal(f.state.fitness!.seats.player.reps, 1);
});

test('Fitness Bro copies share three Reps, supports/tokens/echoes do not qualify, and the third grants Protection', () => {
  const a = defaultUnit('a', 'fitness-bro'),
    z = defaultUnit('z', 'fitness-bro'),
    f = fixture();
  f.enter(a);
  f.enter(z);
  const first = a.hands,
    second = z.hands;
  const support = defaultUnit('support', 'soul-food', 1);
  f.state.units.push(support);
  fitnessPlayed(f.ctx, support);
  const token = defaultUnit('token', 'hooper', 1);
  f.tokens.add(token.id);
  f.state.units.push(token);
  fitnessPlayed(f.ctx, token);
  f.enter(defaultUnit('echo', 'cornball', 1), false);
  f.time(10000);
  assert.equal(a.hands, first);
  for (let i = 1; i <= 4; i++) {
    f.enter(defaultUnit(`paid-${i}`, 'cornball', 1));
    f.time((i + 1) * 10000);
  }
  assert.equal(a.hands, first + 9);
  assert.equal(z.hands, second);
  assert.equal(a.protected, true);
  assert.equal(f.state.fitness!.seats.player.reps, 3);
});

test('disabled Fitness Bro loses the completed pulse payout without a later catch-up', () => {
  const bro = defaultUnit('bro', 'fitness-bro'),
    f = fixture();
  f.enter(bro);
  f.enter(defaultUnit('paid', 'cornball', 1));
  const hands = bro.hands;
  bro.weakened = true;
  f.time(10000);
  bro.weakened = false;
  f.time(20000);
  assert.equal(bro.hands, hands);
});

test('Active Recovery moves first, clears only Burn from destination athletes and heals actual lost Hands without extra buffs', () => {
  const athlete = defaultUnit('athlete', 'hooper', 1, 'player', 4);
  athlete.maxHands = 8;
  athlete.damageTaken = 4;
  athlete.burnStacks = 2;
  athlete.silenced = true;
  const unrelated = defaultUnit('unrelated', 'cornball', 1, 'player', 10);
  const strongLane = defaultUnit('strong-lane', 'hooper', 2, 'player', 30);
  const girl = defaultUnit('girl', 'fitness-girl');
  girl.burnStacks = 2;
  const f = fixture([athlete, unrelated, strongLane]);
  f.enter(girl);
  assert.equal(girl.lane, 1);
  assert.equal(girl.burnStacks, 0);
  assert.equal(athlete.hands, 7);
  assert.equal(athlete.damageTaken, 1);
  assert.equal(athlete.burnStacks, 0);
  assert.equal(athlete.silenced, true);
  assert.equal(unrelated.hands, 10);
});

test('Active Recovery clears a non-Fitness burning ally or gives a clean ally+1, while a failed move gives nothing', () => {
  for (const burning of [true, false]) {
    const target = defaultUnit('target', 'cornball', 1);
    target.burnStacks = burning ? 2 : 0;
    const f = fixture([
      target,
      defaultUnit('strong', 'hooper', 2, 'player', 50),
    ]);
    const girl = defaultUnit('girl', 'fitness-girl');
    const hands = target.hands;
    f.enter(girl);
    assert.equal(target.burnStacks, 0);
    assert.equal(target.hands, hands + (burning ? 0 : 1));
  }
  const target = defaultUnit('target', 'hooper', 1);
  target.burnStacks = 2;
  const girl = defaultUnit('girl', 'fitness-girl'),
    f = fixture([target]);
  f.blocked.add('girl:1');
  f.blocked.add('girl:2');
  assert.equal(f.enter(girl), false);
  assert.equal(target.burnStacks, 2);
});

test('Circuit Training pays the first departure and the third distinct lane, never a two-lane loop', () => {
  const target = defaultUnit('target', 'hooper'),
    trainer = defaultUnit('trainer', 'personal-trainer'),
    f = fixture([target]);
  f.enter(trainer);
  const hands = target.hands;
  f.ctx.move(target, 1);
  assert.equal(target.hands, hands + 3);
  f.ctx.move(target, 0);
  f.ctx.move(target, 1);
  assert.equal(target.hands, hands + 3);
  f.ctx.move(target, 2);
  assert.equal(target.hands, hands + 6);
  assert.equal(target.protected, true);
  assert.equal(f.state.fitness!.seats.player.circuit, undefined);
  f.ctx.move(target, 0);
  assert.equal(target.hands, hands + 6);
});

test('Circuit Training is shared, requires the trainer active, expires after two future intervals, and never retrains the same identity', () => {
  const target = defaultUnit('target', 'hooper'),
    trainer = defaultUnit('trainer', 'personal-trainer'),
    f = fixture([target]);
  f.enter(trainer);
  assert.equal(
    f.enter(defaultUnit('copy', 'personal-trainer', 0, 'player', 9)),
    false,
  );
  const hands = target.hands;
  trainer.silenced = true;
  f.ctx.move(target, 1);
  assert.equal(target.hands, hands);
  trainer.silenced = false;
  f.ctx.move(target, 0);
  f.ctx.move(target, 2);
  assert.equal(target.hands, hands + 3);
  f.time(30000);
  f.ctx.move(target, 1);
  assert.equal(target.hands, hands + 3);
  target.hands = 0;
  const returned = defaultUnit('returned', 'hooper', 2);
  f.state.units.push(returned);
  assert.equal(
    f.enter(defaultUnit('new-trainer', 'personal-trainer', 2)),
    false,
  );
});

test('Demon Trainer requires an actual enemy KO of another real athlete, pays once per pulse and twice per side across copies', () => {
  const demon = defaultUnit('a-demon', 'demon-trainer'),
    copy = defaultUnit('z-demon', 'demon-trainer');
  const enemy = defaultUnit('enemy', 'hooper', 0, 'opponent', 20),
    f = fixture([demon, copy, enemy]);
  const hands = demon.hands;
  for (let i = 0; i < 3; i++) {
    const victim = defaultUnit(`v${i}`, 'fitness-bro', 0, 'player', 1);
    f.state.units.push(victim);
    f.ctx.strike(enemy, victim, 1);
    fitnessEnemyDamage(f.ctx, 'opponent', victim, 1);
    if (i === 1) f.time(10000);
  }
  assert.equal(demon.hands, hands + 4);
  assert.equal(copy.hands, 6);
  assert.equal(enemy.hands, 18);
  assert.equal(f.state.fitness!.seats.player.demonPayouts, 2);
  f.time(20000);
  const fourth = defaultUnit('fourth', 'fitness-bro', 0, 'player', 1);
  f.state.units.push(fourth);
  f.ctx.strike(enemy, fourth, 1);
  assert.equal(demon.hands, hands + 4);
});

test('Demon Trainer never rewards friendly damage, tokens, non-Fitness victims, prevented hits or a disabled/late trainer', () => {
  for (const reason of [
    'friendly',
    'token',
    'non-fitness',
    'prevented',
    'disabled',
    'late',
  ] as const) {
    const demon = defaultUnit('demon', 'demon-trainer'),
      victim = defaultUnit(
        'victim',
        reason === 'non-fitness' ? 'cornball' : 'hooper',
        0,
        'player',
        1,
      );
    const enemy = defaultUnit(
      'enemy',
      'hooper',
      0,
      reason === 'friendly' ? 'player' : 'opponent',
      20,
    );
    const f = fixture(
      reason === 'late' ? [victim, enemy] : [demon, victim, enemy],
    );
    if (reason === 'token') f.tokens.add(victim.id);
    if (reason === 'disabled') demon.silenced = true;
    if (reason === 'prevented') victim.protected = true;
    f.ctx.strike(enemy, victim, 1);
    if (reason === 'late') {
      f.enter(demon);
      fitnessEnemyDamage(f.ctx, 'opponent', victim, 1);
    }
    assert.equal(demon.hands, 6, reason);
  }
});

test('Failed Athlete triggers once when tied/winning becomes losing and disabled transitions do not pay retroactively', () => {
  const u = defaultUnit('athlete', 'failed-athlete', 0, 'player', 4),
    f = fixture();
  f.enter(u);
  f.enter(defaultUnit('enemy', 'hooper', 0, 'opponent', 5));
  assert.equal(u.hands, 8);
  assert.equal(u.protected, true);
  f.enter(defaultUnit('enemy2', 'hooper', 0, 'opponent', 20));
  assert.equal(u.hands, 8);
  const g = fixture(),
    disabled = defaultUnit('disabled', 'failed-athlete');
  g.enter(disabled);
  disabled.silenced = true;
  g.enter(defaultUnit('enemy', 'hooper', 0, 'opponent', 20));
  disabled.silenced = false;
  fitnessAfterBoardChange(g.ctx);
  assert.equal(disabled.hands, 4);
});

test('Failed Athlete deployed losing waits for a later local enemy arrival, and returning does not reset its match receipt', () => {
  const enemy = defaultUnit('enemy', 'hooper', 0, 'opponent', 20),
    u = defaultUnit('athlete', 'failed-athlete'),
    f = fixture([enemy]);
  f.enter(u);
  assert.equal(u.hands, 4);
  f.enter(defaultUnit('elsewhere', 'hooper', 1, 'opponent', 20));
  assert.equal(u.hands, 4);
  f.enter(defaultUnit('later', 'hooper', 0, 'opponent', 20));
  assert.equal(u.hands, 8);
  u.hands = 0;
  const returned = defaultUnit('returned', 'failed-athlete');
  f.enter(returned);
  f.enter(defaultUnit('last', 'hooper', 0, 'opponent', 20));
  assert.equal(returned.hands, 4);
});

test('Sports Prodigy deployed losing gets its immediate+2 and defended1-damage shot', () => {
  const enemy = defaultUnit('enemy', 'hooper', 0, 'opponent', 10),
    u = defaultUnit('prodigy', 'sports-prodigy');
  const f = fixture([enemy]);
  assert.equal(f.enter(u), true);
  assert.equal(u.hands, 7);
  assert.equal(enemy.hands, 9);
  assert.equal(f.state.fitness!.watchers[u.id], undefined);
});

test('Sports Prodigy arms once and requires a true enemy-arrival transition; ordinary damage cannot trigger it', () => {
  const u = defaultUnit('prodigy', 'sports-prodigy'),
    f = fixture();
  f.enter(u);
  f.enter(defaultUnit('enemy', 'hooper', 0, 'opponent', 6));
  assert.equal(u.hands, 7);
  assert.equal(f.state.units.find((x) => x.id === 'enemy')!.hands, 5);
  assert.equal(f.state.fitness!.watchers[u.id], undefined);
  u.hands = 0;
  const returned = defaultUnit('returned', 'sports-prodigy', 2);
  f.enter(returned);
  assert.equal(f.state.fitness!.watchers[returned.id], undefined);
  const g = fixture(),
    v = defaultUnit('v', 'sports-prodigy');
  g.enter(v);
  g.state.units.push(defaultUnit('non-arrival', 'hooper', 0, 'opponent', 20));
  fitnessAfterBoardChange(g.ctx);
  assert.equal(v.hands, 5);
  g.enter(defaultUnit('already-losing-arrival', 'cornball', 0, 'opponent', 1));
  assert.equal(v.hands, 5);
});

test('Sports Prodigy uses an explicit pre-arrival snapshot even if intermediate entrance effects already changed its cached score', () => {
  const u = defaultUnit('prodigy', 'sports-prodigy'),
    f = fixture();
  f.enter(u);
  const before = captureFitnessBoard(f.ctx),
    enemy = defaultUnit('enemy', 'hooper', 0, 'opponent', 8);
  f.state.units.push(enemy);
  fitnessAfterBoardChange(f.ctx); // Intermediate rules mutation.
  assert.equal(u.hands, 5);
  fitnessAfterBoardChange(f.ctx, enemy, before);
  assert.equal(u.hands, 7);
  assert.equal(enemy.hands, 7);
});

test('Sports Prodigy expired or disabled comeback does not fire', () => {
  for (const disabled of [true, false]) {
    const u = defaultUnit('prodigy', 'sports-prodigy'),
      f = fixture();
    f.enter(u);
    if (disabled) u.weakened = true;
    else f.time(20000);
    f.enter(defaultUnit('enemy', 'hooper', 0, 'opponent', 20));
    assert.equal(u.hands, 5);
  }
});

test('Fitness clone deep-copies all ledgers, routes, contracts and watchers while maintaining deterministic results', () => {
  const target = defaultUnit('target', 'calisthenics-yn'),
    f = fixture([target]);
  f.enter(defaultUnit('trainer', 'personal-trainer'));
  f.enter(defaultUnit('spotter', 'gym-spotter-yn'));
  f.enter(defaultUnit('athlete', 'failed-athlete'));
  f.enter(defaultUnit('prodigy', 'sports-prodigy'));
  f.ctx.move(target, 1);
  f.enter(defaultUnit('spotter2', 'gym-spotter-yn', 1));
  const original = f.state.fitness!,
    serialized = JSON.stringify(original),
    copy = cloneFitnessState(original)!;
  copy.routes[target.id].push(2);
  copy.bodyweight[target.id].payouts = 99;
  copy.seats.player.trainedCards.fake = true;
  copy.seats.player.comebackCards.fake = true;
  copy.seats.player.sportsArmedCards.fake = true;
  copy.seats.player.movers.push('fake');
  copy.seats.player.circuit!.visited.push(2);
  copy.wards[0].expiresAt = 1;
  copy.watchers.athlete.ahead = false;
  copy.processedDeaths.fake = true;
  assert.equal(JSON.stringify(original), serialized);
  assert.equal(cloneFitnessState(undefined), undefined);
  assert.deepEqual(cloneFitnessState(JSON.parse(serialized)), original);
});
