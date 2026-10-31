import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { cardCatalog, starterRecipes } from './src/data';
import { FAMILY_IDS } from './src/selectedWave';
import { HOMELESS_CHARACTER_IDS } from './src/homelessFamily';
import {
  createGame,
  type FighterDefinition,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import {
  COMMUNITY_ADAPTERS,
  COMMUNITY_ABILITY_DESCRIPTIONS,
  cloneCommunityState,
  communityArrived,
  communityEnemyDamage,
  communityEntrance,
  communityGained,
  communityMoved,
  communityPreventLethal,
  communityPulse,
  communityResolvedEntrance,
  type CommunityContext,
  type CommunityMatchState,
} from './src/breakthroughCommunity';
const definitions = new Map<string, FighterDefinition>();
for (const card of cardCatalog) {
  const spec =
    COMMUNITY_ADAPTERS[card.catalogId as keyof typeof COMMUNITY_ADAPTERS];
  definitions.set(card.catalogId, {
    id: card.catalogId,
    name: card.name,
    kind: card.kind === 'support' ? 'support' : 'character',
    cost: card.cost,
    hands: card.power,
    art: '',
    element: card.type,
    description: card.effect,
    ability: (spec?.ability ?? 'none') as FighterDefinition['ability'],
    traits: [
      ...(FAMILY_IDS.includes(card.engineId) ? ['family' as const] : []),
      ...((HOMELESS_CHARACTER_IDS as readonly string[]).includes(card.engineId)
        ? ['homeless' as const]
        : []),
    ],
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
    side,
    lane,
    hands: hands ?? base,
    maxHands: hands ?? base,
    baseHands: base,
    position: side === 'player' ? 0.3 : 0.7,
    squabbled: false,
    nextEffectAt: 999999,
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
    community?: CommunityMatchState;
  };
  state.units = units;
  state.roster = [...definitions.values()];
  const blocked = new Set<string>(),
    tokens = new Set<string>(),
    absorbed = new Set<string>();
  const ctx: CommunityContext = {
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
    isAfflicted: (u) =>
      !!(u.frozen || u.silenced || u.weakened || u.burnStacks),
    gain(u, n, copied = false) {
      if (u.hands <= 0) return;
      u.hands += n;
      u.maxHands += n;
      state.events.push({
        id: state.nextEventId++,
        type: 'buff',
        amount: n,
        text: `+${n}`,
      });
      communityGained(ctx, u, n, copied);
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
      if (u.hands <= 0 || n <= 0) return 0;
      u.hands += n;
      u.damageTaken = (u.damageTaken ?? 0) - n;
      communityGained(ctx, u, n);
      return n;
    },
    openForMove(u, lane) {
      return u.lane !== lane && !u.frozen && !blocked.has(`${u.id}:${lane}`);
    },
    move(u, lane) {
      if (!ctx.openForMove(u, lane)) return false;
      const old = u.lane;
      u.lane = lane;
      communityMoved(ctx, u, old);
      return true;
    },
    strike(source, target, amount) {
      if (target.immune || absorbed.has(target.id)) return 0;
      if (target.protected) {
        target.protected = false;
        return 0;
      }
      const prevented = communityPreventLethal(ctx, target, amount);
      const actual = Math.min(target.hands, Math.max(0, amount - prevented));
      target.hands -= actual;
      target.damageTaken = (target.damageTaken ?? 0) + actual;
      communityEnemyDamage(ctx, source.side, target, actual, false);
      return actual;
    },
    removableBonus(u) {
      return Math.max(0, Math.min(u.hands, u.maxHands - u.baseHands));
    },
    trimBonus(source, target, cap) {
      if (target.immune) return 0;
      if (target.protected) {
        target.protected = false;
        return 0;
      }
      const n = Math.min(cap, ctx.removableBonus(target));
      target.hands -= n;
      target.maxHands -= n;
      return n;
    },
    burn(source, target, stacks) {
      if (target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      const before = target.burnStacks ?? 0;
      const extra =
        ctx.definition(source).element === 'Fire' &&
        ctx.definition(target).element === 'Plant'
          ? 1
          : 0;
      target.burnStacks = Math.min(4, before + stacks + extra);
      return target.burnStacks > before;
    },
    event(e) {
      state.events.push({ id: state.nextEventId++, ...e });
    },
    isToken: (u) => tokens.has(u.id),
  };
  const enter = (u: Unit, echoed = false) => {
    if (!state.units.includes(u)) state.units.push(u);
    if (!echoed) communityArrived(ctx, u);
    const success = communityEntrance(ctx, u, echoed);
    communityResolvedEntrance(ctx, u, success === true, echoed);
    return success;
  };
  const time = (ms: number) => {
    state.elapsedMs = ms;
    communityPulse(ctx);
  };
  return { state, ctx, blocked, tokens, absorbed, enter, time };
}

test('Community adapters cover the17 remaining automatic Family/Everybody Eats characters using final catalog identities', () => {
  const excluded = new Set([
    'homeless-guy',
    'homeless-yn',
    'black-air-fade-1s',
  ]);
  const expected = new Set(
    starterRecipes
      .filter((d) => ['sunday-dinner', 'community-table'].includes(d.id))
      .flatMap((d) => d.catalogCardIds)
      .filter((id) => !excluded.has(id)),
  );
  assert.equal(expected.size, 17);
  assert.deepEqual(
    Object.keys(COMMUNITY_ADAPTERS).sort(),
    [...expected].sort(),
  );
  assert.equal(Object.keys(COMMUNITY_ABILITY_DESCRIPTIONS).length, 17);
  for (const spec of Object.values(COMMUNITY_ADAPTERS))
    assert.ok(COMMUNITY_ABILITY_DESCRIPTIONS[spec.ability]);
});

test('Favorite Grandchild moves to the weakest legal lane without changing progress; disabled entrances cannot move', () => {
  const child = unit('child', 'the-favorite-grandchild'),
    f = fixture([unit('strong', 'hooper', 1, 'player', 20)]);
  const progress = child.position;
  assert.equal(f.enter(child), true);
  assert.equal(child.lane, 2);
  assert.equal(child.position, progress);
  for (const status of ['frozen', 'silenced', 'weakened'] as const) {
    const u = unit(status, 'the-favorite-grandchild');
    u[status] = true;
    assert.equal(f.enter(u), false);
    assert.equal(u.lane, 0);
  }
});

test('College Cousin moves Fire or semantic Family allies, gives+2 only once per pulse, but later reveals may still move', () => {
  const family = unit('family', 'church-aunties-rival', 0, 'player', 1),
    fire = unit('fire', 'folks', 0, 'player', 3);
  const f = fixture([family, fire]);
  assert.equal(f.enter(unit('c1', 'cousin-back-from-college')), true);
  assert.equal(family.lane, 1);
  assert.equal(family.hands, 3);
  assert.equal(
    f.enter(unit('c2', 'cousin-back-from-college', 0, 'player', 9)),
    true,
  );
  // The first Cousin is weaker than Fire, so it is the second local Family mover.
  const second = f.state.units.find((x) => x.id === 'c1')!;
  assert.notEqual(second.lane, 0);
  assert.equal(second.hands, 3);
  f.time(10000);
  assert.equal(
    f.enter(unit('c3', 'cousin-back-from-college', 0, 'player', 9)),
    true,
  );
  assert.equal(fire.hands, 5);
});

test('Family membership uses traits/elements instead of names and failed movement spends no Cousin payout', () => {
  const fake = unit('Family Fire cousin name', 'cornball', 0, 'player', 1),
    f = fixture([fake]);
  assert.equal(f.enter(unit('c', 'cousin-back-from-college')), false);
  assert.equal(fake.lane, 0);
  f.state.units.find((u) => u.id === 'c')!.hands = 0;
  const ally = unit('ally', 'folks');
  f.state.units.push(ally);
  ally.frozen = true;
  assert.equal(f.enter(unit('c2', 'cousin-back-from-college')), false);
  ally.frozen = false;
  assert.equal(f.enter(unit('c3', 'cousin-back-from-college')), true);
  assert.equal(ally.hands, 4);
});

test('Plate Auntie prioritizes actual injured Fire/Family, heals only damage, clears only Burn and protects after recovery', () => {
  const hurt = unit('hurt', 'church-aunties-rival', 0, 'player', 1);
  hurt.maxHands = 6;
  hurt.damageTaken = 5;
  hurt.burnStacks = 2;
  hurt.silenced = true;
  const fresh = unit('fresh', 'folks', 0, 'player', 1),
    f = fixture([hurt, fresh]);
  f.enter(unit('auntie', 'plate-auntie'));
  assert.equal(hurt.hands, 4);
  assert.equal(hurt.damageTaken, 2);
  assert.equal(hurt.burnStacks, 0);
  assert.equal(hurt.silenced, true);
  assert.equal(hurt.protected, true);
  assert.equal(fresh.hands, 1);
});

test('Plate Auntie cleanses burning allies without fictitious healing, otherwise grants+3', () => {
  for (const burning of [true, false]) {
    const ally = unit('ally', 'folks');
    ally.burnStacks = burning ? 2 : 0;
    const f = fixture([ally]),
      hands = ally.hands;
    f.enter(unit('auntie', 'plate-auntie'));
    assert.equal(ally.burnStacks, 0);
    assert.equal(ally.hands, hands + (burning ? 0 : 3));
    assert.equal(ally.protected, burning ? true : undefined);
  }
});

test('saved Plates are consumed before buffing and require an active Auntie still at the marked lane', () => {
  const auntie = unit('auntie', 'plate-auntie'),
    f = fixture();
  f.enter(auntie);
  assert.equal(f.state.community!.plates.length, 1);
  const arrival = unit('arrival', 'folks'),
    hands = arrival.hands;
  auntie.silenced = true;
  f.state.units.push(arrival);
  communityArrived(f.ctx, arrival);
  assert.equal(arrival.hands, hands);
  assert.equal(f.state.community!.plates.length, 1);
  auntie.silenced = false;
  communityArrived(f.ctx, arrival);
  assert.equal(arrival.hands, hands + 3);
  communityArrived(f.ctx, arrival);
  assert.equal(arrival.hands, hands + 3);
  assert.equal(f.state.community!.plates.length, 0);
});

test('Plate reservations do not extend through echoes, expire on the boundary and cannot follow a departed Auntie', () => {
  const a = unit('a', 'plate-auntie'),
    f = fixture();
  f.enter(a);
  f.time(15000);
  assert.equal(f.enter(a, true), false);
  assert.equal(f.state.community!.plates[0].expiresAt, 20000);
  f.time(20000);
  const fire = unit('fire', 'folks');
  f.state.units.push(fire);
  const hands = fire.hands;
  communityArrived(f.ctx, fire);
  assert.equal(fire.hands, hands);
  const g = fixture(),
    b = unit('b', 'plate-auntie');
  g.enter(b);
  g.ctx.move(b, 1);
  const u = unit('u', 'folks');
  g.state.units.push(u);
  communityArrived(g.ctx, u);
  assert.equal(u.hands, hands);
});

test('Church Auntie Rival protects and gives+1 only to the weakest eligible other local ally', () => {
  const eligible = unit('eligible', 'folks', 0, 'player', 3),
    unrelated = unit('unrelated', 'cornball', 0, 'player', 1);
  const f = fixture([eligible, unrelated]);
  f.enter(unit('rival', 'church-aunties-rival'));
  assert.equal(eligible.hands, 4);
  assert.equal(eligible.protected, true);
  assert.equal(unrelated.protected, undefined);
});

test('Big Sister rewards movement arrivals only, once per pulse and three times shared across active copies', () => {
  const sister = unit('a-sister', 'big-sister', 1),
    copy = unit('z-sister', 'big-sister', 1);
  const mover = unit('mover', 'folks'),
    f = fixture([sister, copy, mover]);
  const start = mover.hands;
  f.enter(unit('paid', 'folks', 1));
  assert.equal(f.state.units.find((u) => u.id === 'paid')!.hands, start);
  f.ctx.move(mover, 1);
  assert.equal(mover.hands, start + 3);
  f.ctx.move(mover, 0);
  f.ctx.move(mover, 1);
  assert.equal(mover.hands, start + 3);
  for (let i = 1; i <= 3; i++) {
    f.time(i * 10000);
    f.ctx.move(mover, 0);
    f.ctx.move(mover, 1);
  }
  assert.equal(mover.hands, start + 9);
  assert.equal(f.state.community!.seats.player.sisterPayouts, 3);
});

test('Second Plate responds to genuine local Fire/Family gain once per pulse twice total and cannot recursively copy sharing', () => {
  const a = unit('a', 'second-plate-cousin'),
    z = unit('z', 'second-plate-cousin'),
    fire = unit('fire', 'folks');
  const f = fixture([a, z, fire]),
    start = a.hands;
  f.ctx.gain(fire, 1);
  assert.equal(a.hands, start + 3);
  assert.equal(z.hands, 3);
  f.ctx.gain(fire, 1);
  assert.equal(a.hands, start + 3);
  f.time(10000);
  f.ctx.gain(fire, 1, true);
  assert.equal(a.hands, start + 3);
  f.ctx.gain(fire, 1);
  assert.equal(a.hands, start + 6);
  f.time(20000);
  f.ctx.gain(fire, 1);
  assert.equal(a.hands, start + 6);
  assert.equal(f.state.community!.seats.player.sharePayouts, 2);
});

test('Second Plate may respond to actual healing but ignores zero, remote, non-Family and disabled gains', () => {
  const cousin = unit('cousin', 'second-plate-cousin'),
    fire = unit('fire', 'folks', 0, 'player', 1);
  fire.maxHands = 4;
  fire.damageTaken = 3;
  const f = fixture([
    cousin,
    fire,
    unit('ordinary', 'cornball'),
    unit('remote', 'folks', 1),
  ]);
  communityGained(f.ctx, fire, 0);
  f.ctx.gain(f.state.units[2], 1);
  f.ctx.gain(f.state.units[3], 1);
  assert.equal(cousin.hands, 3);
  cousin.weakened = true;
  f.ctx.gain(fire, 1);
  assert.equal(cousin.hands, 3);
  cousin.weakened = false;
  f.ctx.heal(fire, 1);
  assert.equal(cousin.hands, 6);
});

test('Grill Uncle applies defended Burn and gains from actual enemy Burn damage with shared pulse and match caps', () => {
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 20),
    grill = unit('grill', 'grill-uncle'),
    f = fixture([enemy]);
  f.enter(grill);
  assert.equal(enemy.burnStacks, 2);
  const hands = grill.hands;
  communityEnemyDamage(f.ctx, 'player', enemy, 0, true);
  communityEnemyDamage(f.ctx, 'player', enemy, 1, false);
  communityEnemyDamage(f.ctx, 'opponent', enemy, 1, true);
  assert.equal(grill.hands, hands);
  communityEnemyDamage(f.ctx, 'player', enemy, 1, true);
  assert.equal(grill.hands, hands + 2);
  communityEnemyDamage(f.ctx, 'player', enemy, 1, true);
  assert.equal(grill.hands, hands + 2);
  f.time(10000);
  communityEnemyDamage(f.ctx, 'player', enemy, 1, true);
  assert.equal(grill.hands, hands + 4);
  f.time(20000);
  communityEnemyDamage(f.ctx, 'player', enemy, 1, true);
  assert.equal(grill.hands, hands + 4);
});

test('Grill stoke requires another successful non-echo Fire/Family entrance; blocked attempts spend that stoke', () => {
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 20),
    grill = unit('grill', 'grill-uncle'),
    arriving = unit('arriving', 'folks');
  const f = fixture([enemy, grill, arriving]);
  enemy.protected = true;
  communityResolvedEntrance(f.ctx, arriving, false);
  communityResolvedEntrance(f.ctx, arriving, true, true);
  assert.equal(enemy.protected, true);
  communityResolvedEntrance(f.ctx, arriving, true);
  assert.equal(enemy.protected, false);
  assert.equal(enemy.burnStacks, undefined);
  communityResolvedEntrance(f.ctx, arriving, true);
  assert.equal(enemy.burnStacks, undefined);
  f.time(10000);
  communityResolvedEntrance(f.ctx, arriving, true);
  assert.equal(enemy.burnStacks, 1);
  f.time(20000);
  communityResolvedEntrance(f.ctx, arriving, true);
  assert.equal(enemy.burnStacks, 1);
});

test('Grandma requires two distinct real movers for the4-damage version and only spends on an actual hit', () => {
  const mover1 = unit('m1', 'hooper'),
    mover2 = unit('m2', 'hooper'),
    enemy = unit('enemy', 'hooper', 0, 'opponent', 20);
  const grandma = unit('grandma', 'grandma-said-sit-down'),
    f = fixture([mover1, mover2, enemy]);
  enemy.protected = true;
  assert.equal(f.enter(grandma), false);
  assert.equal(f.state.community!.grandmaUsed[grandma.id], undefined);
  f.ctx.move(mover1, 1);
  f.ctx.move(mover1, 0);
  f.ctx.move(mover2, 1);
  assert.equal(communityEntrance(f.ctx, grandma), true);
  assert.equal(enemy.hands, 16);
  assert.equal(communityEntrance(f.ctx, grandma), false);
  assert.equal(enemy.hands, 16);
});

test('Grandma pulse movement requirements ignore repeated same-mover hops and tokens and reset with game time', () => {
  const mover = unit('m', 'hooper'),
    token = unit('token', 'hooper'),
    enemy = unit('enemy', 'hooper', 0, 'opponent', 20);
  const f = fixture([mover, token, enemy]);
  f.tokens.add(token.id);
  f.ctx.move(mover, 1);
  f.ctx.move(mover, 0);
  f.ctx.move(token, 1);
  f.enter(unit('g1', 'grandma-said-sit-down'));
  assert.equal(enemy.hands, 18);
  f.time(10000);
  f.enter(unit('g2', 'grandma-said-sit-down'));
  assert.equal(enemy.hands, 16);
});

test('Instigator remote hit needs actual first damage and two distinct movers', () => {
  const a = unit('a', 'hooper'),
    b = unit('b', 'hooper'),
    local = unit('local', 'hooper', 0, 'opponent', 10),
    remote = unit('remote', 'hooper', 2, 'opponent', 20);
  const f = fixture([a, b, local, remote]);
  f.ctx.move(a, 1);
  f.ctx.move(b, 1);
  local.protected = true;
  assert.equal(f.enter(unit('i1', 'group-chat-instigator')), false);
  assert.equal(remote.hands, 20);
  assert.equal(f.enter(unit('i2', 'group-chat-instigator')), true);
  assert.equal(local.hands, 9);
  assert.equal(remote.hands, 19);
});

test('Homeless Legend prevents lethal before actual damage accounting, including overkill, once across recycle', () => {
  const legend = unit('legend', 'homeless-legend', 0, 'player', 5),
    enemy = unit('enemy', 'hooper', 0, 'opponent', 20),
    f = fixture([legend, enemy]);
  assert.equal(f.ctx.strike(enemy, legend, 100), 4);
  assert.equal(legend.hands, 1);
  assert.equal(legend.damageTaken, 4);
  assert.equal(f.ctx.strike(enemy, legend, 100), 1);
  assert.equal(legend.hands, 0);
  assert.equal(legend.damageTaken, 5);
  const returned = unit('returned', 'homeless-legend');
  f.state.units.push(returned);
  assert.equal(f.ctx.strike(enemy, returned, 100), returned.maxHands);
  assert.equal(returned.hands, 0);
});

test('Homeless Legend does not spend survival on nonlethal/prevented attacks, and disabled Legends cannot survive', () => {
  const legend = unit('legend', 'homeless-legend'),
    f = fixture([legend]);
  assert.equal(communityPreventLethal(f.ctx, legend, 0), 0);
  assert.equal(communityPreventLethal(f.ctx, legend, 1), 0);
  legend.silenced = true;
  assert.equal(communityPreventLethal(f.ctx, legend, 100), 0);
  legend.silenced = false;
  assert.ok(communityPreventLethal(f.ctx, legend, 100) > 0);
});

test('Homeless Legend heals actual damage each pulse without growth, overfill or disabled catch-up', () => {
  const legend = unit('legend', 'homeless-legend', 0, 'player', 1);
  legend.maxHands = 5;
  legend.damageTaken = 4;
  const f = fixture([legend]);
  f.enter(legend);
  f.time(10000);
  assert.equal(legend.hands, 3);
  assert.equal(legend.damageTaken, 2);
  legend.weakened = true;
  f.time(20000);
  assert.equal(legend.hands, 3);
  legend.weakened = false;
  f.time(30000);
  assert.equal(legend.hands, 5);
  assert.equal(legend.damageTaken, 0);
  f.time(40000);
  assert.equal(legend.hands, 5);
  assert.equal(legend.maxHands, 5);
});

test('Cracked Head damages at most three strongest enemies and gains only for actual unblocked hits, capped at2', () => {
  const enemies = [10, 9, 8, 7].map((hands, i) =>
    unit(`e${i}`, 'hooper', 0, 'opponent', hands),
  );
  enemies[0].protected = true;
  const head = unit('head', 'cracked-head'),
    f = fixture([...enemies]),
    start = head.hands;
  assert.equal(f.enter(head), true);
  assert.deepEqual(
    enemies.map((e) => e.hands),
    [10, 8, 7, 7],
  );
  assert.equal(head.hands, start + 2);
});

test('Community Cook prioritizes actual damage recovery and gives a Homeless recipient cleanse,+2 and Protection', () => {
  const recipient = unit('recipient', 'cracked-head', 0, 'player', 1);
  recipient.maxHands = 7;
  recipient.damageTaken = 6;
  recipient.frozen = true;
  recipient.silenced = true;
  recipient.weakened = true;
  recipient.burnStacks = 2;
  const fresh = unit('fresh', 'hooper', 0, 'player', 1),
    f = fixture([recipient, fresh]);
  f.enter(unit('cook', 'community-cook'));
  assert.equal(recipient.hands, 7);
  assert.equal(recipient.damageTaken, 2);
  assert.equal(recipient.maxHands, 9);
  assert.equal(recipient.frozen, false);
  assert.equal(recipient.silenced, false);
  assert.equal(recipient.weakened, false);
  assert.equal(recipient.burnStacks, 0);
  assert.equal(recipient.protected, true);
  assert.equal(fresh.hands, 1);
});

test('meal receipts persist across Cooks and returning recipients, but belong to the receiving side', () => {
  const recipient = unit('recipient', 'homeless-yn'),
    f = fixture([recipient]);
  f.enter(unit('cook1', 'community-cook'));
  const fedHands = recipient.hands;
  f.enter(unit('cook2', 'community-cook', 0, 'player', 20));
  assert.equal(recipient.hands, fedHands);
  recipient.hands = 0;
  const returned = unit('returned', 'homeless-yn', 2);
  f.state.units.push(returned);
  assert.equal(f.enter(unit('cook3', 'community-cook', 2)), false);
  const opposing = unit('opposing', 'homeless-yn', 2, 'opponent');
  f.state.units.push(opposing);
  const base = opposing.hands;
  f.enter(unit('opponent-cook', 'community-cook', 2, 'opponent'));
  assert.equal(opposing.hands, base + 5);
});

test('Foodz cleanses the board, buffs each lane, adds a pre-cleanse Light recovery reward and serves each Homeless lane once', () => {
  const light = unit('light', 'foodz', 0, 'player', 4);
  light.frozen = true;
  light.burnStacks = 1;
  const homeless0 = unit('h0', 'homeless-yn', 0, 'player', 1),
    homeless1 = unit('h1', 'cracked-head', 1, 'player', 2);
  const ordinary = unit('ordinary', 'hooper', 2, 'player', 3);
  ordinary.weakened = true;
  const f = fixture([light, homeless0, homeless1, ordinary]);
  f.enter(unit('foodz', 'foodz', 0, 'player', 20));
  assert.equal(light.frozen, false);
  assert.equal(light.burnStacks, 0);
  assert.equal(light.hands, 6);
  assert.equal(homeless0.hands, 5);
  assert.equal(homeless1.hands, 6);
  assert.equal(ordinary.hands, 5);
  assert.equal(ordinary.weakened, false);
  assert.equal(homeless0.protected, true);
  assert.equal(homeless1.protected, true);
  const before = homeless1.hands;
  f.enter(unit('copy', 'foodz', 0, 'player', 20));
  assert.equal(homeless1.hands, before + 2);
});

test('Foodz does not spend Community Serving while no Homeless ally is present', () => {
  const ordinary = unit('ordinary', 'cornball'),
    f = fixture([ordinary]);
  f.enter(unit('foodz', 'foodz'));
  assert.equal(f.state.community!.seats.player.foodServed, false);
  const homeless = unit('homeless', 'cracked-head', 1);
  f.state.units.push(homeless);
  const hands = homeless.hands;
  f.enter(unit('copy', 'foodz'));
  assert.equal(homeless.hands, hands + 4);
  assert.equal(homeless.protected, true);
});

test('Night Bus picks the weakest movable remote ally, skips frozen/blocked passengers, and only first pickup gets+2 across return', () => {
  const frozen = unit('frozen', 'homeless-yn', 1, 'player', 1);
  frozen.frozen = true;
  const passenger = unit('passenger', 'hooper', 2, 'player', 3),
    bus = unit('bus', 'night-bus-driver'),
    f = fixture([frozen, passenger]);
  f.enter(bus);
  assert.equal(frozen.lane, 1);
  assert.equal(passenger.lane, 0);
  assert.equal(passenger.hands, 5);
  bus.hands = 0;
  const second = unit('second', 'hooper', 2, 'player', 4);
  f.state.units.push(second);
  f.enter(unit('returned-bus', 'night-bus-driver'));
  assert.equal(second.lane, 0);
  assert.equal(second.hands, 4);
});

test('Cyclist gives one post-arrival+1 to a local ally and an empty first arrival still spends that delivery', () => {
  const target = unit('target', 'hooper', 1, 'player', 1),
    strong = unit('strong', 'hooper', 2, 'player', 20);
  const cyclist = unit('cyclist', 'delivery-app-cyclist'),
    f = fixture([target, strong]);
  f.enter(cyclist);
  assert.equal(target.hands, 2);
  assert.equal(cyclist.lane, 1);
  assert.equal(communityEntrance(f.ctx, cyclist), true);
  assert.equal(target.hands, 2);
  const emptyCyclist = unit('empty-cyclist', 'delivery-app-cyclist'),
    g = fixture();
  g.enter(emptyCyclist);
  assert.equal(g.state.community!.cyclistUsed[emptyCyclist.id], true);
  const future = unit('future', 'hooper', 0, 'player', 1);
  g.state.units.push(future);
  g.blocked.add('empty-cyclist:2');
  communityEntrance(g.ctx, emptyCyclist);
  assert.equal(future.hands, 1);
});

test('Bluetooth Unc removes only Silence from the weakest silenced ally, otherwise protects the weakest', () => {
  const target = unit('target', 'hooper', 0, 'player', 5);
  target.silenced = true;
  target.burnStacks = 2;
  target.weakened = true;
  const weak = unit('weak', 'folks', 0, 'player', 1),
    f = fixture([target, weak]);
  f.enter(unit('unc', 'bluetooth-unc'));
  assert.equal(target.silenced, false);
  assert.equal(target.weakened, true);
  assert.equal(target.burnStacks, 2);
  assert.equal(weak.protected, undefined);
  f.enter(unit('unc2', 'bluetooth-unc'));
  assert.equal(weak.protected, true);
});

test('Booster steals only removable bonus through defenses and spends its receipt only when a steal lands', () => {
  const enemy = unit('enemy', 'hooper', 0, 'opponent', 8);
  enemy.baseHands = 4;
  enemy.maxHands = 8;
  enemy.protected = true;
  const booster = unit('booster', 'booster'),
    f = fixture([enemy]),
    hands = booster.hands;
  assert.equal(f.enter(booster), false);
  assert.equal(enemy.hands, 8);
  assert.equal(f.state.community!.boosterUsed[booster.id], undefined);
  assert.equal(communityEntrance(f.ctx, booster), true);
  assert.equal(enemy.hands, 7);
  assert.equal(booster.hands, hands + 1);
  assert.equal(communityEntrance(f.ctx, booster), false);
  assert.equal(enemy.hands, 7);
});

test('Community state clones deeply own pending plates, stable receipts, per-instance spends and movement histories', () => {
  const f = fixture(),
    auntie = unit('auntie', 'plate-auntie');
  f.enter(auntie);
  const fire = unit('fire', 'folks', 1);
  f.state.units.push(fire);
  f.ctx.move(fire, 2);
  const original = f.state.community!,
    serialized = JSON.stringify(original),
    copy = cloneCommunityState(original)!;
  copy.plates[0].expiresAt = 1;
  copy.seats.player.movers.push('fake');
  copy.seats.player.mealReceipts.fake = true;
  copy.seats.player.survivalReceipts.fake = true;
  copy.seats.player.busReceipts.fake = true;
  copy.cyclistUsed.fake = true;
  copy.grandmaUsed.fake = true;
  copy.boosterUsed.fake = true;
  assert.equal(JSON.stringify(original), serialized);
  assert.deepEqual(cloneCommunityState(JSON.parse(serialized)), original);
  assert.equal(cloneCommunityState(undefined), undefined);
});
