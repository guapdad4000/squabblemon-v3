import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { catalogCardById } from './src/data';
import {
  advance,
  deploy,
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
  SUMMON_ADAPTERS,
  SUMMON_ARTWORK,
  SUMMON_TOKEN_DEFINITIONS,
  cloneSummonState,
  summonEntrance,
  summonMoved,
  summonPlayed,
  summonTick,
  type SummonContext,
} from './src/breakthroughSummons';

type TestUnit = Unit & {
  origin?: 'deck' | 'summon';
  canFight?: boolean;
  canBreach?: boolean;
  countsHands?: boolean;
  stationary?: boolean;
  artworkId?: string;
};
const templateIds = new Set<string>(
  SUMMON_TOKEN_DEFINITIONS.map((card) => card.id),
);
const definitions: FighterDefinition[] = [
  ...BREAKTHROUGH_ROSTER.filter(
    (card) => !Object.hasOwn(SUMMON_ADAPTERS, card.id),
  ),
  ...Object.entries(SUMMON_ADAPTERS).map(([id, adapter]) => {
    const card = catalogCardById[id];
    return {
      id,
      name: card.name,
      art: '',
      cost: card.cost,
      hands: card.power,
      kind: 'character' as const,
      element: card.type,
      ability: adapter.ability as FighterDefinition['ability'],
      description: '',
    };
  }),
  ...(SUMMON_TOKEN_DEFINITIONS.map((card) => ({
    ...card,
    triggers: [...card.triggers],
  })) as FighterDefinition[]),
];
let identity = 0;
function unit(
  id: string,
  side: Side = 'player',
  lane: Lane = 0,
  hands?: number,
): TestUnit {
  const card = definitions.find((card) => card.id === id)!;
  assert.ok(card, id);
  return {
    id: `summons-${++identity}`,
    cardId: id,
    side,
    lane,
    position: side === 'player' ? 0.15 : 0.85,
    hands: hands ?? card.hands,
    maxHands: hands ?? card.hands,
    baseHands: card.hands,
    squabbled: false,
    nextEffectAt: 999999,
    arrivalOrder: identity,
    origin: 'deck',
  };
}
function harness(units: TestUnit[] = [], rolls: number[] = []) {
  const deck = BREAKTHROUGH_ROSTER.filter((card) => card.kind === 'character')
    .slice(0, 10)
    .map((card) => card.id);
  const state = createGame(BREAKTHROUGH_ROSTER, {
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
  state.roster = definitions;
  state.units = units;
  delete state.summons;
  for (const side of ['player', 'opponent'] as const) {
    state.players[side].hand = [];
    state.players[side].queue = [];
  }
  let calls = 0;
  const event = (value: Omit<BattleEvent, 'id'>) =>
    state.events.push({ ...value, id: state.nextEventId++ });
  const ctx: SummonContext = {
    state,
    definition: (target) =>
      definitions.find((card) => card.id === target.cardId)!,
    active: (target) =>
      target.hands > 0 &&
      !target.silenced &&
      !target.weakened &&
      !target.frozen,
    power: (target) => (target.frozen ? 0 : target.hands),
    gain: (target, amount) => {
      target.hands += amount;
      target.maxHands += amount;
      event({
        type: 'buff',
        side: target.side,
        lane: target.lane,
        amount,
        text: `+${amount}`,
      });
    },
    protect: (target) => {
      target.protected = true;
    },
    damage: (_source, target, amount) => {
      if (target.immune) return 0;
      if (target.protected) {
        target.protected = false;
        return 0;
      }
      const actual = Math.min(target.hands, amount);
      target.hands -= actual;
      return actual;
    },
    execute: (_source, target, maxHands) => {
      if (maxHands !== undefined && ctx.power(target) > maxHands) return false;
      if (target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      state.units = state.units.filter((unit) => unit.id !== target.id);
      return true;
    },
    openForMove: (target, lane) =>
      !target.frozen &&
      target.lane !== lane &&
      !state.units.some(
        (enemy) =>
          enemy.side !== target.side &&
          enemy.lane === lane &&
          enemy.hands > 0 &&
          enemy.cardId !== 'demario-mushroom' &&
          Math.abs(enemy.position - target.position) < 0.22,
      ),
    move: (target, lane) => {
      if (!ctx.openForMove(target, lane)) return false;
      target.lane = lane;
      summonMoved(ctx, target);
      return true;
    },
    moveEnemy: (source, target, lane, followUp) => {
      if (!ctx.openForMove(target, lane) || target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      const moved = ctx.move(target, lane);
      if (moved && followUp?.burn)
        target.burnStacks = (target.burnStacks ?? 0) + followUp.burn;
      if (moved && followUp?.damage)
        ctx.damage(source, target, followUp.damage);
      return moved;
    },
    openForSummon: (_side, lane) => [0, 1, 2].includes(lane),
    spawn: (source, cardId, lane, options) => {
      if (!ctx.openForSummon(source.side, lane)) return undefined;
      const created = unit(cardId, source.side, lane, options.hands);
      created.origin = 'summon';
      created.position = source.side === 'player' ? 0 : 1;
      if (options.kind === 'mushroom') {
        created.position = source.side === 'player' ? 0.12 : 0.88;
        created.stationary = true;
        created.canFight = created.canBreach = created.countsHands = false;
      } else created.canFight = created.canBreach = created.countsHands = true;
      state.units.push(created);
      event({
        type: 'summon',
        side: source.side,
        lane,
        targetUnitId: created.id,
        cardId,
        sourceUnitId: source.id,
        text: 'SUMMON',
      });
      return created;
    },
    consume: (target) => {
      state.units = state.units.filter((unit) => unit.id !== target.id);
    },
    burn: (_source, target, stacks) => {
      if (target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      target.burnStacks = (target.burnStacks ?? 0) + stacks;
      return true;
    },
    random: () => {
      const result = rolls[calls] ?? 0.99;
      calls++;
      return result;
    },
    setForm: (target, artworkId) => {
      (target as TestUnit).artworkId = artworkId;
    },
    event,
  };
  return { ctx, calls: () => calls };
}
const count = (ctx: SummonContext, id: string) =>
  ctx.state.units.filter((unit) => unit.cardId === id).length;
test('eight collectible summon adapters remain distinct from three runtime templates and use existing optimized art', () => {
  assert.equal(Object.keys(SUMMON_ADAPTERS).length, 8);
  for (const id of Object.keys(SUMMON_ADAPTERS)) assert.ok(catalogCardById[id]);
  for (const template of SUMMON_TOKEN_DEFINITIONS) {
    assert.equal(catalogCardById[template.id], undefined);
    assert.equal(Object.hasOwn(SUMMON_ADAPTERS, template.id), false);
  }
  for (const art of Object.values(SUMMON_ARTWORK))
    assert.ok(
      existsSync(
        new URL(`../../artifacts/squabblemon/public${art}`, import.meta.url),
      ),
      art,
    );
});
test('Shiesty chain resolves seeded 50% flips to at most eight extra ordinary fighters, never squared recursive copies', () => {
  const source = unit('shiesty-yn');
  source.squabbled = true;
  source.hands = source.maxHands = 2;
  const { ctx, calls } = harness([source], Array(20).fill(0.1));
  summonEntrance(ctx, source);
  assert.equal(count(ctx, 'shiesty-yn'), 9);
  assert.equal(calls(), 8);
  for (const copy of ctx.state.units.filter(
    (unit) => unit.id !== source.id,
  ) as TestUnit[]) {
    assert.equal(copy.hands, 1);
    assert.equal(copy.squabbled, false);
    assert.equal(copy.origin, 'summon');
    assert.equal(copy.position, 0);
    assert.equal(copy.canBreach, true);
  }
  assert.equal(ctx.state.players.player.hand.length, 0);
  assert.equal(ctx.state.players.player.returns.length, 0);
});
test('Shiesty stops on the first miss and uses symmetric opponent home entrances', () => {
  const source = unit('shiesty-yn', 'opponent', 2),
    { ctx, calls } = harness([source], [0.1, 0.1, 0.6, 0.1]);
  summonEntrance(ctx, source);
  assert.equal(count(ctx, 'shiesty-yn'), 3);
  assert.equal(calls(), 3);
  assert.ok(
    ctx.state.units
      .filter((unit) => unit.id !== source.id)
      .every(
        (unit) =>
          unit.position === 1 && unit.side === 'opponent' && unit.lane === 2,
      ),
  );
});
test('Naija summons once per side/match and Protects the weakest actual other character, excluding its low-Hands token', () => {
  const source = unit('naija-scammer'),
    ally = unit('stockz', 'player', 0, 3),
    high = unit('plug', 'player', 0, 8),
    { ctx } = harness([source, ally, high]);
  summonEntrance(ctx, source);
  assert.equal(count(ctx, 'fake-marriage'), 1);
  assert.equal(ally.protected, true);
  const token = ctx.state.units.find(
    (unit) => unit.cardId === 'fake-marriage',
  )!;
  assert.notEqual(token.protected, true);
  ctx.consume(token);
  summonEntrance(ctx, source);
  assert.equal(count(ctx, 'fake-marriage'), 0);
  const opposite = unit('naija-scammer', 'opponent');
  ctx.state.units.push(opposite);
  summonEntrance(ctx, opposite);
  assert.equal(count(ctx, 'fake-marriage'), 1);
});
test('blocked Naija summon does not spend the one-match opportunity or grant a phantom shield', () => {
  const source = unit('naija-scammer'),
    ally = unit('stockz'),
    { ctx } = harness([source, ally]);
  ctx.openForSummon = () => false;
  summonEntrance(ctx, source);
  assert.equal(count(ctx, 'fake-marriage'), 0);
  assert.notEqual(ally.protected, true);
  ctx.openForSummon = () => true;
  summonEntrance(ctx, source);
  assert.equal(count(ctx, 'fake-marriage'), 1);
});
test('Fake Marriage pays only for other friendly fighters moved into its lane, once each pulse and at most twice', () => {
  const token = unit('fake-marriage'),
    ally = unit('stockz'),
    enemy = unit('stockz', 'opponent'),
    { ctx } = harness([token, ally, enemy]);
  summonMoved(ctx, token);
  summonMoved(ctx, enemy);
  assert.equal(token.hands, 1);
  summonMoved(ctx, ally);
  summonMoved(ctx, ally);
  assert.equal(token.hands, 2);
  ctx.state.elapsedMs = 10000;
  summonMoved(ctx, ally);
  assert.equal(token.hands, 3);
  ctx.state.elapsedMs = 20000;
  summonMoved(ctx, ally);
  assert.equal(token.hands, 3);
});
test('Silence blocks Fake Marriage movement income without consuming its two lifetime payouts', () => {
  const token = unit('fake-marriage'),
    ally = unit('stockz'),
    { ctx } = harness([token, ally]);
  token.silenced = true;
  summonMoved(ctx, ally);
  assert.equal(token.hands, 1);
  token.silenced = false;
  summonMoved(ctx, ally);
  assert.equal(token.hands, 2);
});
test('held Demario plants one stationary non-scoring Mushroom at pulse zero and every new global pulse, including Last Stand', () => {
  const { ctx } = harness([], [0, 0.4, 0.9, 0]);
  ctx.state.players.player.hand = ['demario'];
  summonTick(ctx);
  assert.equal(count(ctx, 'demario-mushroom'), 1);
  summonTick(ctx);
  assert.equal(count(ctx, 'demario-mushroom'), 1);
  ctx.state.elapsedMs = 10000;
  summonTick(ctx);
  assert.equal(count(ctx, 'demario-mushroom'), 2);
  ctx.state.elapsedMs = 150000;
  summonTick(ctx);
  assert.equal(count(ctx, 'demario-mushroom'), 3);
  for (const mushroom of ctx.state.units as TestUnit[]) {
    assert.equal(mushroom.canFight, false);
    assert.equal(mushroom.canBreach, false);
    assert.equal(mushroom.countsHands, false);
    assert.equal(mushroom.stationary, true);
    assert.equal(mushroom.position, 0.12);
  }
  ctx.state.players.player.hand = [];
  ctx.state.elapsedMs = 160000;
  summonTick(ctx);
  assert.equal(count(ctx, 'demario-mushroom'), 3);
});
test('Demario reveal plants once into legal seeded lane without imposing an invented four-card limit', () => {
  const source = unit('demario'),
    crowd = Array.from({ length: 12 }, () => unit('stockz', 'player', 2)),
    { ctx } = harness([source, ...crowd], [0.9]);
  summonEntrance(ctx, source);
  assert.equal(count(ctx, 'demario-mushroom'), 1);
  assert.equal(
    ctx.state.units.find((unit) => unit.cardId === 'demario-mushroom')!.lane,
    2,
  );
});
test('only a paid character consumes one oldest friendly Mushroom at placement, before its reveal; actions/echoes/summons never consume', () => {
  const source = unit('demario'),
    first = unit('demario-mushroom'),
    second = unit('demario-mushroom'),
    enemy = unit('demario-mushroom', 'opponent'),
    entrant = unit('stockz'),
    { ctx } = harness([source, first, second, enemy, entrant]);
  summonPlayed(ctx, entrant);
  assert.equal(entrant.hands, 6);
  assert.equal(count(ctx, 'demario-mushroom'), 2);
  summonPlayed(ctx, entrant);
  assert.equal(entrant.hands, 6);
  assert.equal(count(ctx, 'demario-mushroom'), 2);
  assert.equal(
    ctx.state.units.some((unit) => unit.id === first.id),
    false,
  );
  assert.equal(
    ctx.state.units.some((unit) => unit.id === second.id),
    true,
  );
  const demario = unit('demario');
  ctx.state.units.push(demario);
  const next = harness([demario], [0]).ctx;
  summonPlayed(next, demario);
  summonEntrance(next, demario);
  assert.equal(demario.hands, 3);
  assert.equal(count(next, 'demario-mushroom'), 1);
});
test('normal Luigion splits +1 with its weakest other character and consumes at most one Mushroom; solo form gets the fallback +1', () => {
  const source = unit('luigion'),
    ally = unit('stockz'),
    mushroom = unit('demario-mushroom'),
    spare = unit('demario-mushroom'),
    { ctx } = harness([source, ally, mushroom, spare]);
  summonPlayed(ctx, source);
  assert.equal(count(ctx, 'demario-mushroom'), 2);
  summonEntrance(ctx, source);
  assert.equal(source.hands, 6);
  assert.equal(ally.hands, 5);
  assert.equal(count(ctx, 'demario-mushroom'), 1);
  summonEntrance(ctx, source, { echo: true });
  assert.equal(source.hands, 7);
  assert.equal(count(ctx, 'demario-mushroom'), 1);
  const solo = unit('luigion'),
    alone = harness([solo]).ctx;
  summonEntrance(alone, solo);
  assert.equal(solo.hands, 5);
});
test('Powered Luigion uses actual form art, replaces the solo fallback when eating, and gains jump bonus only on a successful legal move', () => {
  const source = unit('luigion');
  source.squabbled = true;
  source.hands = source.maxHands = 6;
  const mushroom = unit('demario-mushroom'),
    { ctx } = harness([source, mushroom]);
  summonEntrance(ctx, source);
  assert.equal(source.hands, 10);
  assert.equal(source.artworkId, 'luigion-powered');
  assert.equal(source.lane, 1);
  const position = source.position;
  summonEntrance(ctx, source, { echo: true });
  assert.equal(source.lane, 1);
  assert.equal(source.position, position);
  assert.equal(source.hands, 12);
});
test('Queen only executes eligible weakest effective-Hands enemies and creates a two-Hand guard on an actual execution', () => {
  const queen = unit('queen-of-hearts'),
    weak = unit('stockz', 'opponent', 0, 5),
    strong = unit('stockz', 'opponent', 0, 9),
    { ctx } = harness([queen, weak, strong]);
  summonEntrance(ctx, queen);
  assert.equal(
    ctx.state.units.some((unit) => unit.id === weak.id),
    false,
  );
  assert.equal(count(ctx, 'card-guard'), 1);
  const guard = ctx.state.units.find(
    (unit) => unit.cardId === 'card-guard',
  ) as TestUnit;
  assert.equal(guard.hands, 2);
  assert.equal(guard.canBreach, true);
  assert.equal(guard.origin, 'summon');
  assert.equal(guard.position, 0);
  summonEntrance(ctx, queen);
  assert.equal(count(ctx, 'card-guard'), 1);
});
test('Queen respects Protection/immunity and does not create a guard when authored first-lethal survival saves the victim', () => {
  const queen = unit('queen-of-hearts'),
    victim = unit('stockz', 'opponent', 0, 4),
    { ctx } = harness([queen, victim]);
  victim.protected = true;
  summonEntrance(ctx, queen);
  assert.equal(count(ctx, 'card-guard'), 0);
  assert.equal(victim.protected, false);
  victim.immune = true;
  summonEntrance(ctx, queen);
  assert.equal(count(ctx, 'card-guard'), 0);
  victim.immune = false;
  ctx.execute = (_source, target) => {
    target.hands = 1;
    return false;
  };
  summonEntrance(ctx, queen);
  assert.equal(count(ctx, 'card-guard'), 0);
  assert.equal(victim.hands, 1);
});
test('Red Robber hits here then a single seeded other-lane copy hits there; generated copies never restart the summon chance', () => {
  const robber = unit('red-side-3'),
    enemy = unit('stockz', 'opponent', 0, 8),
    other = unit('stockz', 'opponent', 2, 8),
    { ctx, calls } = harness([robber, enemy, other], [0.1, 0.9]);
  summonEntrance(ctx, robber);
  assert.equal(enemy.hands, 7);
  assert.equal(other.hands, 7);
  assert.equal(count(ctx, 'red-side-3'), 2);
  const copy = ctx.state.units.find(
    (unit) => unit.id !== robber.id && unit.cardId === 'red-side-3',
  )!;
  summonEntrance(ctx, copy);
  assert.equal(other.hands, 6);
  assert.equal(count(ctx, 'red-side-3'), 2);
  assert.equal(calls(), 2);
});
test('Witch hits only positive bonus-Hands enemies, gains only for actual damage, and summons one monkey without its entrance', () => {
  const witch = unit('wicked-witch'),
    boosted = unit('stockz', 'opponent', 0, 7),
    defended = unit('stockz', 'opponent', 0, 8),
    base = unit('stockz', 'opponent', 0, 4),
    { ctx } = harness([witch, boosted, defended, base]);
  defended.protected = true;
  summonEntrance(ctx, witch);
  assert.equal(boosted.hands, 5);
  assert.equal(defended.hands, 8);
  assert.equal(base.hands, 4);
  assert.equal(witch.hands, catalogCardById['wicked-witch'].power + 1);
  assert.equal(count(ctx, 'flying-monkeys'), 1);
  assert.equal(boosted.lane, 0);
  assert.equal(base.lane, 0);
  assert.equal(
    ctx.state.units.find((unit) => unit.cardId === 'flying-monkeys')!.hands,
    5,
  );
});
test('Flying Monkeys move the weakest enemy to its weakest legal other lane then apply Burn; blocked moves cannot apply Burn', () => {
  const monkeys = unit('flying-monkeys'),
    weak = unit('stockz', 'opponent', 0, 3),
    strong = unit('stockz', 'opponent', 0, 7),
    { ctx } = harness([monkeys, weak, strong]);
  weak.protected = true;
  summonEntrance(ctx, monkeys);
  assert.equal(weak.lane, 0);
  assert.equal(weak.burnStacks, undefined);
  summonEntrance(ctx, monkeys);
  assert.notEqual(weak.lane, 0);
  assert.equal(weak.burnStacks, 1);
  assert.equal(strong.lane, 0);
  strong.frozen = true;
  summonEntrance(ctx, monkeys);
  assert.equal(strong.lane, 0);
  assert.equal(strong.burnStacks, undefined);
});
test('Summon state clone isolates once-per-match spending, per-token pulse payouts, and resource-consumption identity', () => {
  const source = unit('naija-scammer'),
    ally = unit('stockz'),
    mushroom = unit('demario-mushroom'),
    { ctx } = harness([source, ally, mushroom]);
  summonEntrance(ctx, source);
  summonMoved(ctx, ally);
  summonPlayed(ctx, ally);
  const before = JSON.stringify(ctx.state.summons),
    clone = cloneSummonState(ctx.state.summons)!;
  clone.marriageUsed.player = false;
  Object.values(clone.marriageGrowth)[0].used = 20;
  delete clone.mushroomUsed[ally.id];
  assert.equal(JSON.stringify(ctx.state.summons), before);
  assert.equal(cloneSummonState(undefined), undefined);
});

function actualState(units: Unit[] = []) {
  const deck = BREAKTHROUGH_ROSTER.filter((card) => card.kind === 'character')
    .slice(0, 10)
    .map((card) => card.id);
  const state = createGame(BREAKTHROUGH_ROSTER, {
    seed: 44,
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
  id: string,
  lane: Lane = 0,
  squabble = false,
) {
  state.players.player.hand = [id];
  const result = deploy(state, 'player', id, lane, squabble);
  assert.equal(
    result.error,
    undefined,
    `${id} works through actual core deploy`,
  );
  return result.state;
}
test('core Shiesty summon chains replay deterministically, start at home, and generated casualties never return to deck/hand', () => {
  const initial = actualState();
  initial.players.player.hand = ['shiesty-yn'];
  initial.effectsRng = 0;
  const first = deploy(initial, 'player', 'shiesty-yn', 1);
  assert.equal(first.error, undefined);
  const copies = first.state.units.filter(
    (unit) => unit.cardId === 'shiesty-yn' && unit.origin === 'summon',
  );
  assert.ok(copies.length > 0 && copies.length <= 8);
  assert.ok(
    copies.every(
      (unit) =>
        unit.position === 0 &&
        unit.hands === catalogCardById['shiesty-yn'].power &&
        unit.canBreach &&
        unit.canFight &&
        unit.countsHands,
    ),
  );
  assert.deepEqual(replayCommand(initial, first.state.commands.at(-1)!), first);
  for (const copy of copies) copy.hands = 0;
  const cleaned = advance(first.state, 50);
  assert.equal(cleaned.players.player.returns.length, 0);
  assert.equal(cleaned.players.player.hand.length, 0);
  assert.equal(cleaned.players.player.queue.length, 0);
});
test('core Mushroom resource stays stationary, cannot fight, and never pads timeout Hands', () => {
  const foe = unit('stockz', 'opponent', 2, 5);
  let state = actualState([foe]);
  state = actualPlay(state, 'demario', 0);
  const mushroom = state.units.find(
    (unit) => unit.cardId === 'demario-mushroom',
  )!;
  assert.ok(mushroom);
  assert.equal(mushroom.origin, 'summon');
  assert.equal(mushroom.canFight, false);
  assert.equal(mushroom.canBreach, false);
  assert.equal(mushroom.countsHands, false);
  const position = mushroom.position;
  state.durationMs = 2000;
  state = advance(state, 2000);
  assert.equal(
    state.units.find((unit) => unit.id === mushroom.id)!.position,
    position,
  );
  assert.equal(state.players.player.breaches, 0);
  assert.equal(state.winner, 'opponent');
});
test('core enemy contact ignores Mushrooms rather than fighting or getting blocked by a consumable resource', () => {
  let state = actualState();
  state = actualPlay(state, 'demario');
  const mushroom = state.units.find(
    (unit) => unit.cardId === 'demario-mushroom',
  )!;
  const enemy = unit('stockz', 'opponent', mushroom.lane, 9);
  enemy.position = mushroom.position + 0.01;
  state.units = [mushroom, enemy];
  state = advance(state, 50);
  assert.equal(state.units.find((unit) => unit.id === mushroom.id)!.hands, 2);
  assert.equal(state.units.find((unit) => unit.id === enemy.id)!.hands, 9);
  assert.equal(
    state.events.some(
      (event) => event.type === 'damage' && event.targetUnitId === mushroom.id,
    ),
    false,
  );
});
test('core Queen execution respects Protection and creates a nonrecycling home-entry guard only after a real kill', () => {
  const target = unit('stockz', 'opponent', 0, 5);
  target.protected = true;
  let state = actualState([target]);
  state = actualPlay(state, 'queen-of-hearts');
  assert.equal(count({ state } as SummonContext, 'card-guard'), 0);
  assert.equal(
    state.units.find((unit) => unit.id === target.id)!.protected,
    false,
  );
  state.players.player.motion = 9;
  state = actualPlay(state, 'queen-of-hearts');
  const guard = state.units.find((unit) => unit.cardId === 'card-guard')!;
  assert.ok(guard);
  assert.equal(guard.hands, 2);
  assert.equal(guard.origin, 'summon');
  assert.equal(guard.position, 0);
  guard.hands = 0;
  state = advance(state, 50);
  assert.equal(
    state.players.player.returns.some((card) => card.cardId === 'card-guard'),
    false,
  );
});
test('core Naija one-match summon survives parent recycling and token defeat without rearming', () => {
  const ally = unit('stockz', 'player', 0, 3);
  let state = actualState([ally]);
  state = actualPlay(state, 'naija-scammer');
  const marriage = state.units.find((unit) => unit.cardId === 'fake-marriage')!;
  assert.ok(marriage);
  assert.equal(
    state.units.find((unit) => unit.id === ally.id)!.protected,
    true,
  );
  marriage.hands = 0;
  state = advance(state, 50);
  state.players.player.motion = 9;
  state = actualPlay(state, 'naija-scammer');
  assert.equal(
    state.units.filter((unit) => unit.cardId === 'fake-marriage').length,
    0,
  );
  assert.equal(
    state.players.player.returns.some(
      (card) => card.cardId === 'fake-marriage',
    ),
    false,
  );
});
test('core Powered Luigion consumes one Mushroom and uses the optimized approved powered artwork', () => {
  let state = actualState();
  state = actualPlay(state, 'demario');
  const mushroom = state.units.find(
    (unit) => unit.cardId === 'demario-mushroom',
  )!;
  const lane = mushroom.lane;
  state.units = [mushroom];
  state.players.player.motion = 9;
  state = actualPlay(state, 'luigion', lane, true);
  const luigion = state.units.find((unit) => unit.cardId === 'luigion')!;
  assert.equal(luigion.squabbled, true);
  assert.equal(luigion.hands, catalogCardById.luigion.power * 2 + 4);
  assert.equal(luigion.art, SUMMON_ARTWORK['luigion-powered']);
  assert.notEqual(luigion.lane, lane);
  assert.equal(
    state.units.some((unit) => unit.id === mushroom.id),
    false,
  );
  assert.equal(
    state.players.player.returns.some(
      (card) => card.cardId === 'demario-mushroom',
    ),
    false,
  );
});

test('core Queen rechecks execution threshold on the actual high-Hands interceptor and does not award a phantom guard', () => {
  const partner = unit('plug', 'player', 0, 1);
  let state = actualState([partner]);
  state = actualPlay(state, 'stud');
  const stud = state.units.find((unit) => unit.cardId === 'stud')!;
  stud.hands = stud.maxHands = 8;
  state.players.opponent.hand = ['queen-of-hearts'];
  state.players.opponent.motion = 9;
  const result = deploy(state, 'opponent', 'queen-of-hearts', 0);
  assert.equal(result.error, undefined);
  assert.ok(result.state.units.some((unit) => unit.id === stud.id));
  assert.equal(
    result.state.units.find((unit) => unit.id === stud.id)!.hands,
    8,
  );
  assert.equal(
    result.state.units.some((unit) => unit.cardId === 'card-guard'),
    false,
  );
});
