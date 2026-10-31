import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardCatalog } from './src/data';
import { GANG_BY_CARD_ID } from './src/tripleOgs';
import {
  createGame,
  type FighterDefinition,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import {
  REACTION_ADAPTERS,
  REACTION_ABILITY_DESCRIPTIONS,
  cloneReactionState,
  reactionCleansed,
  reactionDamaged,
  reactionDeploymentBaseHands,
  reactionDestroyed,
  reactionEntrance,
  reactionGained,
  reactionMoved,
  reactionPlayed,
  reactionPreventEnemyLoss,
  reactionPulse,
  reactionRefunded,
  type ReactionContext,
  type ReactionMatchState,
  type ReactionSource,
} from './src/breakthroughReactions';
const defs = new Map<string, FighterDefinition>();
for (const c of cardCatalog) {
  const a = REACTION_ADAPTERS[c.catalogId as keyof typeof REACTION_ADAPTERS];
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
    faction: c.faction,
    gangColor: GANG_BY_CARD_ID[c.engineId],
    ability: (a?.ability ?? 'none') as FighterDefinition['ability'],
  });
}
function u(
  id: string,
  cardId: string,
  lane: Lane = 0,
  side: Side = 'player',
  hands?: number,
): Unit {
  const h = defs.get(cardId)?.hands ?? 3;
  return {
    id,
    cardId,
    side,
    lane,
    position: side === 'player' ? 0.3 : 0.7,
    hands: hands ?? h,
    baseHands: h,
    maxHands: hands ?? h,
    squabbled: false,
    nextEffectAt: 999999,
  };
}
const src = (x: Unit): ReactionSource => ({
  id: x.id,
  cardId: x.cardId,
  side: x.side,
  lane: x.lane,
  position: x.position,
});
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
    reactions?: ReactionMatchState;
  };
  state.units = units;
  state.roster = [...defs.values()];
  state.players.player.hand = [];
  state.players.opponent.hand = [];
  const blocked = new Set<string>(),
    tokens = new Set<string>();
  const ctx: ReactionContext = {
    state,
    definition: (x) =>
      defs.get(x.cardId) ?? {
        id: x.cardId,
        kind: 'character',
        ability: 'none',
      },
    active: (x) => x.hands > 0 && !x.frozen && !x.silenced && !x.weakened,
    effectiveHands: (x) => (x.frozen ? 0 : Math.max(0, x.hands)),
    isAfflicted: (x) =>
      !!(x.frozen || x.silenced || x.weakened || x.burnStacks),
    gain(x, n, copied = false, source) {
      if (n <= 0 || x.hands <= 0) return;
      x.hands += n;
      x.maxHands += n;
      state.events.push({
        id: state.nextEventId++,
        type: 'buff',
        amount: n,
        text: `+${n}`,
      });
      reactionGained(ctx, x, n, copied, source, n);
    },
    protect(x) {
      x.protected = true;
    },
    cleanse(x, kinds = ['burn', 'freeze', 'silence', 'weaken'], source) {
      const before = [
        x.burnStacks ?? 0,
        x.frozen ?? false,
        x.silenced ?? false,
        x.weakened ?? false,
      ];
      if (kinds.includes('burn')) x.burnStacks = 0;
      if (kinds.includes('freeze')) x.frozen = false;
      if (kinds.includes('silence')) x.silenced = false;
      if (kinds.includes('weaken')) x.weakened = false;
      const after = [
        x.burnStacks ?? 0,
        x.frozen ?? false,
        x.silenced ?? false,
        x.weakened ?? false,
      ];
      reactionCleansed(
        ctx,
        x,
        JSON.stringify(before) !== JSON.stringify(after),
        source,
      );
    },
    heal(x, cap, source) {
      const n = Math.min(
        cap,
        x.damageTaken ?? 0,
        Math.max(0, x.maxHands - x.hands),
      );
      if (x.hands <= 0 || !n) return 0;
      x.hands += n;
      x.damageTaken = (x.damageTaken ?? 0) - n;
      reactionGained(ctx, x, n, false, source, 0);
      return n;
    },
    weaken(source, target) {
      let landed = false;
      ctx.hostilePackage(source, target, () => {
        landed = ctx.rawWeaken(source, target);
      });
      return landed;
    },
    hostilePackage(source, target, apply) {
      if (target.hands <= 0 || target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      apply(target);
      return true;
    },
    rawWeaken(source, target) {
      const added = !target.weakened;
      target.weakened = true;
      return added;
    },
    rawDamage(source, target, n) {
      const prevented =
        source.side === target.side
          ? 0
          : reactionPreventEnemyLoss(ctx, target, n);
      const actual = Math.min(target.hands, Math.max(0, n - prevented));
      target.hands -= actual;
      target.damageTaken = (target.damageTaken ?? 0) + actual;
      reactionDamaged(
        ctx,
        { sourceSide: source.side, sourceUnitId: source.id },
        target,
        actual,
        { ability: true },
      );
      return actual;
    },
    strike(source, target, n) {
      let actual = 0;
      ctx.hostilePackage(source, target, () => {
        actual = ctx.rawDamage(source, target, n);
      });
      return actual;
    },
    removableBonus(x) {
      return Math.max(0, Math.min(x.hands, x.maxHands - x.baseHands));
    },
    removeBonus(source, target, cap) {
      let n = 0;
      ctx.hostilePackage(source, target, () => {
        n = Math.min(cap, ctx.removableBonus(target));
        target.hands -= n;
        target.maxHands -= n;
      });
      return n;
    },
    motion(side, amount, source, kind) {
      const p = state.players[side],
        n = Math.min(amount, Math.max(0, 9 - p.motion));
      p.motion += n;
      if (kind === 'refund') reactionRefunded(ctx, side, n, source.cardId);
      return n;
    },
    sacrificeHands(x, amount) {
      const n = Math.min(amount, Math.max(0, x.hands - 1));
      x.hands -= n;
      return n;
    },
    openForMove(x, lane) {
      return (
        x.hands > 0 &&
        x.lane !== lane &&
        !x.frozen &&
        !blocked.has(`${x.id}:${lane}`) &&
        !x.movementLocks?.some((y) => y.expiresAt > state.elapsedMs)
      );
    },
    move(x, lane) {
      if (!ctx.openForMove(x, lane)) return false;
      const old = x.lane;
      x.lane = lane;
      reactionMoved(ctx, x, old);
      return true;
    },
    event(e) {
      state.events.push({ id: state.nextEventId++, ...e });
    },
    isToken: (x) => tokens.has(x.id),
  };
  function enter(x: Unit, echoed = false) {
    if (!state.units.includes(x)) state.units.push(x);
    if (!echoed)
      reactionPlayed(
        ctx,
        x,
        defs.get(x.cardId)?.kind === 'support' ? 'support' : 'character',
      );
    return reactionEntrance(ctx, x, echoed);
  }
  function time(ms: number) {
    state.elapsedMs = ms;
    reactionPulse(ctx);
  }
  return { state, ctx, enter, time, blocked, tokens };
}

test('the exact35 assigned canonical fighters have explicit concrete reaction adapters', () => {
  const ids =
    'alchy incel fangirl counter street-apostle bonnet-girl trap-vamp squabble-house-male squabble-house-female monsoon-anchor slipstream nail-tech torta rooftop-gardener pirate-radio-dj powerhouse rainmaker canopy-keeper hater work-hubby blue-side-4 blue-side-5 red-side-5 ganger-blue corrupt-pastor barbershop-heckler indian-scammer hair-stylist stylist inmate-crafty inmate-boyfriend og-uncle-harley-davidson suga-mama side-chick gas-station-window-wiper'.split(
      ' ',
    );
  assert.equal(ids.length, 35);
  assert.deepEqual(Object.keys(REACTION_ADAPTERS).sort(), ids.sort());
  assert.equal(Object.keys(REACTION_ABILITY_DESCRIPTIONS).length, 35);
  for (const id of ids) assert.ok(cardCatalog.find((c) => c.catalogId === id));
});

test('Alchy starts at30seconds, reads lane advantage at the pulse and stops while disabled', () => {
  const x = u('alchy', 'alchy'),
    enemy = u('enemy', 'hooper', 0, 'opponent', 20),
    f = fixture([x, enemy]);
  f.enter(x);
  const h = x.hands;
  f.time(20000);
  assert.equal(x.hands, h);
  f.time(30000);
  assert.equal(x.hands, h + 2);
  enemy.hands = 0;
  f.time(40000);
  assert.equal(x.hands, h + 3);
  x.silenced = true;
  f.time(50000);
  assert.equal(x.hands, h + 3);
});

test('Incel solitude requires no other local fighter and pays at most twice across returns', () => {
  const x = u('incel', 'incel'),
    f = fixture([x]);
  f.enter(x);
  const h = x.hands;
  f.time(10000);
  assert.equal(x.hands, h + 2);
  f.state.units.push(u('friend', 'hooper'));
  f.time(20000);
  assert.equal(x.hands, h + 2);
  f.state.units.find((y) => y.id === 'friend')!.hands = 0;
  f.time(30000);
  assert.equal(x.hands, h + 4);
  x.hands = 0;
  const returned = u('returned', 'incel');
  f.enter(returned);
  f.time(40000);
  assert.equal(returned.hands, h);
});

test('Fangirl selects the strongest other local idol and responds once per pulse to genuine idol gains', () => {
  const idol = u('idol', 'hooper', 0, 'player', 8),
    weak = u('weak', 'cornball', 0, 'player', 1),
    fan = u('fan', 'fangirl'),
    f = fixture([idol, weak]);
  f.enter(fan);
  const h = fan.hands;
  f.ctx.gain(weak, 2);
  assert.equal(fan.hands, h);
  f.ctx.gain(idol, 1);
  f.ctx.gain(idol, 1);
  assert.equal(fan.hands, h + 1);
  f.time(10000);
  fan.weakened = true;
  f.ctx.gain(idol, 1);
  assert.equal(fan.hands, h + 1);
});

test('Street Apostle copies up to2 to other Plant lanes once per pulse and cannot recurse from copied gains', () => {
  const leader = u('leader', 'street-apostle'),
    plant = u('plant', 'buddy', 0),
    remote = u('remote', 'buddy', 1),
    other = u('other', 'buddy', 2);
  const f = fixture([leader, plant, remote, other]);
  f.enter(leader);
  const h = [remote.hands, other.hands];
  f.ctx.gain(plant, 4, true);
  assert.deepEqual([remote.hands, other.hands], h);
  f.ctx.gain(plant, 4);
  assert.deepEqual(
    [remote.hands, other.hands],
    h.map((n) => n + 2),
  );
  f.ctx.gain(plant, 4);
  assert.deepEqual(
    [remote.hands, other.hands],
    h.map((n) => n + 2),
  );
});

test('Shotta entry damage and two shared off-lane paid-character encores do not respond to actions or movement', () => {
  const a = u('a', 'counter'),
    local = u('local', 'hooper', 0, 'opponent', 20),
    remote = u('remote', 'hooper', 1, 'opponent', 20),
    f = fixture([local, remote]);
  f.enter(a);
  assert.equal(local.hands, 18);
  f.enter(u('paid1', 'cornball', 1));
  assert.equal(remote.hands, 19);
  f.enter(u('paid2', 'cornball', 1));
  assert.equal(remote.hands, 19);
  f.time(10000);
  f.enter(u('support', 'soul-food', 1));
  assert.equal(remote.hands, 19);
  f.enter(u('paid3', 'cornball', 1));
  assert.equal(remote.hands, 18);
  f.time(20000);
  f.enter(u('paid4', 'cornball', 1));
  assert.equal(remote.hands, 18);
});

test('Bonnet reacts to real enemy combat or ability damage to another ally, once, and never to zero/friendly damage', () => {
  const bonnet = u('bonnet', 'bonnet-girl'),
    victim = u('victim', 'hooper'),
    f = fixture([bonnet, victim]);
  f.enter(bonnet);
  const h = bonnet.hands;
  reactionDamaged(f.ctx, { sourceSide: 'opponent' }, victim, 0, {
    ability: true,
  });
  reactionDamaged(f.ctx, { sourceSide: 'player' }, victim, 1, {
    ability: true,
  });
  assert.equal(bonnet.hands, h);
  reactionDamaged(f.ctx, { sourceSide: 'opponent' }, victim, 1, {
    ability: false,
  });
  assert.equal(bonnet.hands, h + 2);
  f.time(10000);
  reactionDamaged(f.ctx, { sourceSide: 'opponent' }, victim, 2, {
    ability: true,
  });
  assert.equal(bonnet.hands, h + 2);
});

test('Trap Vamp pays only for actual friendly ability damage and bounds its one-pulse payout to2', () => {
  const vamp = u('vamp', 'trap-vamp'),
    victim = u('victim', 'hooper', 0, 'opponent', 20),
    f = fixture([vamp, victim]);
  f.enter(vamp);
  const h = vamp.hands;
  reactionDamaged(f.ctx, { sourceSide: 'player' }, victim, 4, {
    ability: false,
  });
  assert.equal(vamp.hands, h);
  reactionDamaged(f.ctx, { sourceSide: 'player' }, victim, 4, {
    ability: true,
  });
  assert.equal(vamp.hands, h + 2);
  reactionDamaged(f.ctx, { sourceSide: 'player' }, victim, 4, {
    ability: true,
  });
  assert.equal(vamp.hands, h + 2);
});

test('Cook retaliates only against a surviving ability source, once per pulse, without combat recursion', () => {
  const cook = u('cook', 'squabble-house-male'),
    ally = u('ally', 'hooper'),
    enemy = u('enemy', 'hooper', 0, 'opponent', 20),
    f = fixture([cook, ally, enemy]);
  f.enter(cook);
  reactionDamaged(
    f.ctx,
    { sourceSide: 'opponent', sourceUnitId: enemy.id },
    ally,
    2,
    { ability: false },
  );
  assert.equal(enemy.hands, 20);
  reactionDamaged(
    f.ctx,
    { sourceSide: 'opponent', sourceUnitId: enemy.id },
    ally,
    2,
    { ability: true },
  );
  assert.equal(enemy.hands, 18);
  reactionDamaged(
    f.ctx,
    { sourceSide: 'opponent', sourceUnitId: enemy.id },
    ally,
    2,
    { ability: true },
  );
  assert.equal(enemy.hands, 18);
});

test('Server clears only Burn/Freeze from the weakest affected friendly fighter, including itself when eligible', () => {
  const target = u('target', 'hooper', 0, 'player', 8);
  target.frozen = true;
  target.burnStacks = 2;
  target.silenced = true;
  const f = fixture([target]);
  f.enter(u('server', 'squabble-house-female'));
  assert.equal(target.frozen, false);
  assert.equal(target.burnStacks, 0);
  assert.equal(target.silenced, true);
});

test('Monsoon entry Weaken respects defenses and its held pulse chooses one weakest Water fighter per lane', () => {
  const water = cardCatalog.find(
    (c) => c.type === 'Water' && c.kind !== 'support',
  )!.catalogId;
  const a = u('a', water, 0, 'player', 1),
    b = u('b', water, 0, 'player', 8),
    c = u('c', water, 1, 'player', 3),
    f = fixture([a, b, c]);
  f.state.players.player.hand = ['monsoon-anchor'];
  reactionPulse(f.ctx);
  f.time(10000);
  assert.deepEqual([a.hands, b.hands, c.hands], [2, 8, 4]);
  const enemy = u('enemy', 'hooper', 0, 'opponent', 20);
  enemy.protected = true;
  f.state.units.push(enemy);
  assert.equal(f.enter(u('chef1', 'monsoon-anchor')), false);
  assert.equal(enemy.weakened, undefined);
  assert.equal(f.enter(u('chef2', 'monsoon-anchor')), true);
  assert.equal(enemy.weakened, true);
});

test('Boarding Pass pays only on one successful move before expiry, and held Air bond remains separate', () => {
  const air = cardCatalog.find(
    (c) =>
      c.type === 'Air' && c.kind !== 'support' && c.catalogId !== 'slipstream',
  )!.catalogId;
  const target = u('target', air),
    f = fixture([target]);
  f.enter(u('flight', 'slipstream'));
  const h = target.hands;
  f.blocked.add('target:1');
  assert.equal(f.ctx.move(target, 1), false);
  assert.equal(target.hands, h);
  f.blocked.clear();
  f.ctx.move(target, 1);
  assert.equal(target.hands, h + 2);
  assert.equal(target.protected, true);
  f.ctx.move(target, 0);
  assert.equal(target.hands, h + 2);
  f.state.players.player.hand = ['slipstream'];
  f.time(10000);
  assert.equal(target.hands, h + 3);
});

test('Nail reinforcement is one positive enemy-loss reduction rather than a permanent shield', () => {
  const ally = u('ally', 'hooper'),
    f = fixture([ally]);
  f.enter(u('nail', 'nail-tech'));
  const h = ally.hands;
  assert.equal(reactionPreventEnemyLoss(f.ctx, ally, 0), 0);
  assert.equal(reactionPreventEnemyLoss(f.ctx, ally, 5), 1);
  assert.equal(reactionPreventEnemyLoss(f.ctx, ally, 5), 0);
  assert.equal(ally.hands, h);
});

test('Torta pair settles only after the next interval, requires both in the origin and cannot be farmed by replacement pairs', () => {
  const earth = cardCatalog.find(
    (c) =>
      ['Earth', 'Rock'].includes(c.type) &&
      c.kind !== 'support' &&
      c.catalogId !== 'torta',
  )!.catalogId;
  const partner = u('partner', earth),
    torta = u('torta', 'torta'),
    f = fixture([partner]);
  f.enter(torta);
  const h = [partner.hands, torta.hands];
  assert.equal(f.enter(u('copy', 'torta')), false);
  f.time(10000);
  assert.deepEqual([partner.hands, torta.hands], h);
  f.time(20000);
  assert.deepEqual(
    [partner.hands, torta.hands],
    h.map((n) => n + 3),
  );
  const g = fixture([u('partner', earth)]),
    t = u('t', 'torta');
  g.enter(t);
  g.ctx.move(t, 1);
  g.time(20000);
  assert.equal(t.hands, defs.get('torta')!.hands);
});

test('Torta and Gardener settle pending final-time contracts even when duration ends between regular pulses', () => {
  const earth = cardCatalog.find(
    (c) =>
      ['Earth', 'Rock'].includes(c.type) &&
      c.kind !== 'support' &&
      c.catalogId !== 'torta',
  )!.catalogId;
  const partner = u('partner', earth),
    torta = u('torta', 'torta'),
    plant = u('plant', 'buddy', 1),
    f = fixture([partner, plant]);
  f.state.durationMs = 15000;
  f.enter(torta);
  f.enter(u('gardener', 'rooftop-gardener', 1));
  const h = partner.hands;
  f.time(10000);
  const p = plant.hands;
  f.time(15000);
  assert.equal(partner.hands, h + 3);
  assert.equal(plant.hands, p);
  f.time(15000);
  assert.equal(partner.hands, h + 3);
});

test('Gardener seeds survive the source, choose weakest Plant at pulse and expire on empty plots without repeated harvest', () => {
  const plant = u('plant', 'buddy', 0, 'player', 1),
    gardener = u('gardener', 'rooftop-gardener'),
    f = fixture([plant]);
  f.enter(gardener);
  assert.equal(f.enter(u('copy', 'rooftop-gardener')), false);
  gardener.hands = 0;
  f.state.units.find((x) => x.id === 'copy')!.hands = 0;
  f.time(10000);
  assert.equal(plant.hands, 5);
  f.time(20000);
  assert.equal(plant.hands, 5);
});

test('Pirate DJ entry spreads local-independent gifts and only the second paid Electric fighter gets its board boost', () => {
  const dj = u('dj', 'pirate-radio-dj'),
    remote = u('remote', 'hooper', 1),
    f = fixture([remote]);
  const h = remote.hands;
  f.enter(dj);
  assert.equal(remote.hands, h + 1);
  const electric = cardCatalog.find(
    (c) =>
      c.type === 'Electric' &&
      c.kind !== 'support' &&
      c.catalogId !== 'pirate-radio-dj',
  )!.catalogId;
  const next = u('next', electric),
    before = next.hands;
  f.enter(next);
  assert.equal(next.hands, before + 1);
  const third = u('third', electric),
    thirdH = third.hands;
  f.enter(third);
  assert.equal(third.hands, thirdH);
});

test('Powerhouse banks only actual other-card refunds while held and damage uses the capped persistent bank', () => {
  const enemy = u('enemy', 'hooper', 0, 'opponent', 20),
    f = fixture([enemy]);
  f.state.players.player.hand = ['powerhouse'];
  reactionRefunded(f.ctx, 'player', 0, 'water-boy');
  reactionRefunded(f.ctx, 'opponent', 3, 'water-boy');
  f.ctx.motion(
    'player',
    1,
    {
      id: 'income',
      cardId: 'rainmaker',
      side: 'player',
      lane: 0,
      position: 0,
    },
    'income',
  );
  assert.equal(f.state.reactions?.banked['player:powerhouse'], undefined);
  reactionRefunded(f.ctx, 'player', 2, 'water-boy');
  reactionRefunded(f.ctx, 'player', 4, 'rainmaker');
  const power = u('power', 'powerhouse');
  f.enter(power);
  assert.equal(enemy.hands, 17);
  f.enter(power, true);
  assert.equal(enemy.hands, 14);
});

test('Rainmaker refunds once per card across echoes/return and held income has shared caps with persistent base loss', () => {
  const f = fixture();
  f.state.players.player.motion = 0;
  const rain = u('rain', 'rainmaker');
  f.enter(rain);
  assert.equal(f.state.players.player.motion, 2);
  f.enter(rain, true);
  assert.equal(f.state.players.player.motion, 2);
  rain.hands = 0;
  f.enter(u('returned', 'rainmaker'));
  assert.equal(f.state.players.player.motion, 2);
  f.state.players.player.hand = ['rainmaker'];
  f.time(10000);
  f.time(20000);
  f.time(30000);
  f.time(40000);
  assert.equal(f.state.players.player.motion, 5);
  assert.equal(reactionDeploymentBaseHands(f.ctx, 'player', 'rainmaker', 4), 1);
  assert.equal(
    reactionDeploymentBaseHands(f.ctx, 'opponent', 'rainmaker', 4),
    4,
  );
});

test('Rainmaker capped-zero income never costs base Hands or spends a successful payout', () => {
  const f = fixture();
  f.state.players.player.hand = ['rainmaker'];
  f.state.players.player.motion = 9;
  reactionPulse(f.ctx);
  f.time(10000);
  assert.equal(reactionDeploymentBaseHands(f.ctx, 'player', 'rainmaker', 4), 4);
  f.state.players.player.motion = 8.5;
  f.time(20000);
  assert.equal(f.state.players.player.motion, 9);
  assert.equal(reactionDeploymentBaseHands(f.ctx, 'player', 'rainmaker', 4), 3);
});

test('Canopy initial help cannot fulfil itself, and genuine help needs a known different card source', () => {
  const target = u('target', 'buddy', 0, 'player', 1),
    keeper = u('keeper', 'canopy-keeper'),
    helper = u('helper', 'hooper'),
    f = fixture([target, helper]);
  f.enter(keeper);
  const h = target.hands;
  assert.equal(h, 3);
  f.ctx.gain(target, 1);
  assert.equal(target.hands, h + 1);
  f.ctx.gain(target, 1, false, src(keeper));
  assert.equal(target.hands, h + 2);
  f.ctx.gain(target, 1, false, src(helper));
  assert.equal(target.hands, h + 6);
  assert.equal(keeper.hands, defs.get('canopy-keeper')!.hands + 1);
  f.ctx.gain(target, 1, false, src(helper));
  assert.equal(target.hands, h + 7);
});

test('Canopy can fulfil from actual cleanse/healing, while zero recovery and expired promises cannot pay', () => {
  for (const kind of ['cleanse', 'heal', 'expired'] as const) {
    const target = u('target', 'cornball', 0, 'player', 1),
      keeper = u('keeper', 'canopy-keeper'),
      helper = u('helper', 'hooper'),
      f = fixture([target, helper]);
    f.enter(keeper);
    const h = target.hands;
    if (kind === 'expired') f.time(30000);
    if (kind === 'cleanse') {
      target.silenced = true;
      f.ctx.cleanse(target, undefined, src(helper));
      assert.equal(target.hands, h + 2);
    } else {
      target.maxHands += 2;
      target.damageTaken = 2;
      f.ctx.heal(target, 1, src(helper));
      assert.equal(target.hands, h + (kind === 'expired' ? 1 : 3));
    }
  }
});

test('Hater trims only new bonus through defenses, never base or restored damage, and only actual removal pays', () => {
  const hater = u('hater', 'hater', 0, 'opponent'),
    target = u('target', 'hooper'),
    f = fixture([hater, target]),
    start = hater.hands;
  f.ctx.gain(target, 2);
  assert.equal(target.hands, target.baseHands + 1);
  assert.equal(hater.hands, start + 1);
  f.time(10000);
  target.hands -= 1;
  target.damageTaken = 1;
  const before = target.hands;
  f.ctx.heal(target, 1);
  assert.equal(target.hands, before + 1);
  assert.equal(hater.hands, start + 1);
  target.protected = true;
  f.ctx.gain(target, 1);
  assert.equal(hater.hands, start + 1);
  assert.equal(target.protected, false);
});

test('Lunch Bond requires a genuine non-shared client gain and an active Hubby; copies/returns cannot reissue', () => {
  const target = u('target', 'hooper'),
    hubby = u('hubby', 'work-hubby'),
    f = fixture([target]);
  f.enter(hubby);
  const h = hubby.hands;
  f.ctx.gain(target, 1, true);
  assert.equal(hubby.hands, h);
  hubby.weakened = true;
  f.ctx.gain(target, 1);
  assert.equal(hubby.hands, h);
  hubby.weakened = false;
  f.ctx.gain(target, 1);
  assert.equal(hubby.hands, h + 1);
  f.ctx.gain(target, 1);
  assert.equal(hubby.hands, h + 1);
  hubby.hands = 0;
  assert.equal(f.enter(u('returned', 'work-hubby')), false);
});

test('Blue Loco clears only Freeze/Silence and boosts the affected pick; fallback Protects an unprotected ally and grows', () => {
  const ally = u('ally', 'hooper');
  ally.frozen = true;
  ally.silenced = true;
  ally.burnStacks = 2;
  const blue = u('blue', 'blue-side-4'),
    f = fixture([ally]),
    h = ally.hands;
  f.enter(blue);
  assert.equal(ally.hands, h + 2);
  assert.equal(ally.frozen, false);
  assert.equal(ally.silenced, false);
  assert.equal(ally.burnStacks, 2);
  const next = u('next', 'blue-side-4');
  const before = next.hands;
  f.enter(next);
  assert.equal(next.hands, before + 1);
});

test('Blue Big Trippin needs actual Weaken and destroyed active copies arm a next-character gift that supports cannot waste', () => {
  const enemy = u('enemy', 'hooper', 0, 'opponent', 20),
    blue = u('blue', 'blue-side-5'),
    f = fixture([enemy]);
  enemy.protected = true;
  assert.equal(f.enter(blue), false);
  const h = blue.hands;
  assert.equal(reactionEntrance(f.ctx, blue), true);
  assert.equal(blue.hands, h + 1);
  blue.hands = 0;
  reactionDestroyed(f.ctx, blue);
  reactionDestroyed(f.ctx, blue);
  f.enter(u('action', 'soul-food'));
  assert.equal(f.state.reactions!.nextBlue.player, 1);
  const next = u('next', 'cornball'),
    n = next.hands;
  f.enter(next);
  assert.equal(next.hands, n + 1);
  assert.equal(f.state.reactions!.nextBlue.player, 0);
});

test('Red Shades prefers semantic Red Set/Side across lanes and Ganger Blue gives the larger remote Blue package', () => {
  const red = cardCatalog.find(
    (c) => c.faction === 'Red Side' && c.catalogId !== 'red-side-5',
  )!.catalogId;
  const chosen = u('red', red, 2, 'player', 4),
    ordinary = u('ordinary', 'cornball', 1, 'player', 1),
    f = fixture([chosen, ordinary]);
  f.enter(u('shades', 'red-side-5'));
  assert.equal(chosen.hands, 7);
  assert.equal(ordinary.hands, 1);
  const blue = u('blue', 'blue-side-5', 1, 'player', 3);
  blue.gangColor = 'blue';
  const g = fixture([blue]);
  const ganger = u('ganger', 'ganger-blue'),
    h = ganger.hands;
  g.enter(ganger);
  assert.equal(blue.hands, 7);
  assert.equal(blue.protected, true);
  assert.equal(ganger.hands, h + 1);
});

test('Pastor collects actual nonlethal friendly donations without creating damage or heal receipts', () => {
  const a = u('a', 'hooper', 0, 'player', 3),
    b = u('b', 'cornball', 0, 'player', 1),
    pastor = u('pastor', 'corrupt-pastor'),
    f = fixture([a, b]);
  const h = pastor.hands;
  f.enter(pastor);
  assert.equal(a.hands, 2);
  assert.equal(b.hands, 1);
  assert.equal(a.damageTaken, undefined);
  assert.equal(pastor.hands, h + 2);
});

test('Heckler/Scammer require actual bonus removal, respect Protection, and Scammer successful receipt stays spent', () => {
  for (const id of ['barbershop-heckler', 'indian-scammer'] as const) {
    const foe = u('foe', 'hooper', 0, 'opponent', 8);
    foe.baseHands = 4;
    const ally = u('ally', 'cornball'),
      actor = u('actor', id),
      f = fixture([foe, ally]);
    foe.protected = true;
    assert.equal(f.enter(actor), false);
    const h = ally.hands;
    assert.equal(reactionEntrance(f.ctx, actor), true);
    assert.equal(foe.hands, 6);
    assert.equal(ally.hands, h + 1);
    if (id === 'indian-scammer') {
      assert.equal(ally.protected, true);
      assert.equal(reactionEntrance(f.ctx, actor), false);
    }
  }
});

test('Blowout pays its next-move reward only after actual cleanse and Stylist protects once per fitted target identity', () => {
  const target = u('target', 'hooper');
  target.silenced = true;
  const f = fixture([target]);
  f.enter(u('hair', 'hair-stylist'));
  const h = target.hands;
  f.ctx.move(target, 1);
  assert.equal(target.hands, h + 1);
  f.ctx.move(target, 0);
  assert.equal(target.hands, h + 1);
  f.state.units.find((x) => x.id === 'hair')!.hands = 0;
  f.enter(u('stylist', 'stylist'));
  target.protected = false;
  f.ctx.move(target, 1);
  assert.equal(target.protected, true);
  target.hands = 0;
  const returned = u('returned', 'hooper', 2);
  f.state.units.push(returned);
  assert.equal(f.enter(u('stylist2', 'stylist', 2)), false);
});

test('Crafty accepts explicit local Cellblock or same-pulse support action, not names, past-pulse actions or tokens', () => {
  const f = fixture([u('Inmate by name', 'hooper')]);
  assert.equal(f.enter(u('first', 'inmate-crafty', 2)), false);
  f.enter(u('action', 'soul-food', 1));
  const crafty = u('crafty', 'inmate-crafty', 1),
    h = crafty.hands;
  assert.equal(f.enter(crafty), true);
  assert.equal(crafty.hands, h + 3);
  f.time(10000);
  assert.equal(f.enter(u('later', 'inmate-crafty', 0)), false);
});

test('Inmate Boyfriend gives independent local and semantic Cellblock remote gifts', () => {
  const local = u('local', 'hooper'),
    inmate = u('inmate', 'inmate-crafty', 2),
    f = fixture([local, inmate]);
  const h = [local.hands, inmate.hands];
  f.enter(u('boyfriend', 'inmate-boyfriend'));
  assert.deepEqual([local.hands, inmate.hands], [h[0] + 3, h[1] + 2]);
});

test('Harley and Window Wiper act only after real legal movement; Suga Mama checks the post-help lane score', () => {
  const ally = u('ally', 'cornball', 1, 'player', 1),
    enemy = u('enemy', 'hooper', 1, 'opponent', 20),
    f = fixture([ally, enemy, u('strong', 'hooper', 2, 'player', 50)]);
  const harley = u('harley', 'og-uncle-harley-davidson'),
    before = harley.hands;
  f.enter(harley);
  assert.equal(harley.lane, 1);
  assert.equal(harley.hands, before + 1);
  assert.equal(ally.hands, 3);
  const wiper = u('wiper', 'gas-station-window-wiper');
  f.enter(wiper);
  assert.equal(enemy.hands, 19);
  wiper.hands = 0;
  ally.burnStacks = 1;
  f.enter(u('suga', 'suga-mama'));
  assert.equal(ally.hands, 5);
  assert.equal(ally.burnStacks, 0);
  assert.equal(ally.protected, true);
  const blocked = u('blocked', 'og-uncle-harley-davidson');
  f.blocked.add('blocked:1');
  f.blocked.add('blocked:2');
  const h = blocked.hands;
  assert.equal(f.enter(blocked), false);
  assert.equal(blocked.hands, h);
});

test('Side Chick uses canonical listed identities from anywhere and one shield blocks the entire damage/Weaken package', () => {
  const wife = u('wife', 'wifey', 2, 'opponent', 10),
    local = u('local', 'hooper', 0, 'opponent', 20),
    f = fixture([wife, local]);
  wife.protected = true;
  assert.equal(f.enter(u('side1', 'side-chick')), false);
  assert.equal(wife.hands, 10);
  assert.equal(wife.weakened, undefined);
  assert.equal(local.hands, 20);
  assert.equal(f.enter(u('side2', 'side-chick')), true);
  assert.equal(wife.hands, 7);
  assert.equal(wife.weakened, true);
});

test('Reaction runtime deep clone owns all contracts, ledgers and held-card progression without shared mutation', () => {
  const target = u('target', 'hooper'),
    f = fixture([target]);
  f.enter(u('fan', 'fangirl'));
  f.enter(u('hair', 'hair-stylist'));
  f.state.units.find((x) => x.id === 'hair')!.hands = 0;
  f.enter(u('stylist', 'stylist'));
  f.state.players.player.hand = ['rainmaker'];
  f.time(10000);
  const original = f.state.reactions!,
    text = JSON.stringify(original),
    copy = cloneReactionState(original)!;
  copy.used.fake = true;
  copy.pulseUses.fake = 99;
  copy.counts.fake = 99;
  copy.idols.fake = 'fake';
  copy.nails.fake = true;
  copy.moves[0].source.id = 'fake';
  copy.banked.fake = 99;
  copy.rainBaseLost.fake = 99;
  copy.supportPresence.fake = 99;
  copy.nextBlue.player = 99;
  copy.electricCounts.player.count = 99;
  copy.destroyed.fake = true;
  assert.equal(JSON.stringify(original), text);
  assert.deepEqual(cloneReactionState(JSON.parse(text)), original);
  assert.equal(cloneReactionState(undefined), undefined);
});

test('Canopy accepts genuine copied help from another card because its contract does not forbid sharing', () => {
  const target = u('target', 'cornball', 0, 'player', 1),
    keeper = u('keeper', 'canopy-keeper'),
    helper = u('helper', 'street-apostle');
  const f = fixture([target, helper]);
  f.enter(keeper);
  const before = target.hands;
  f.ctx.gain(target, 1, true, src(helper));
  assert.equal(target.hands, before + 3);
  assert.equal(f.state.reactions!.promises.player, undefined);
});
