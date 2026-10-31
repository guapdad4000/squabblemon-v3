import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { catalogCardById } from './src/data';
import {
  advance,
  createGame,
  deploy,
  deploymentCost,
  deploymentChoices,
  replayCommand,
  type BattleEvent,
  type FighterDefinition,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import { BREAKTHROUGH_ROSTER } from './src/breakthroughCatalog';
import {
  BLOCKBUSTER_ADAPTERS,
  BLOCKBUSTER_ABILITY_DESCRIPTIONS,
  blockbusterLegal,
  blockbusterTick,
  cloneBlockbusterState,
  homelessInvestment,
  recordBlockbusterReduction,
  resolveBlockbuster,
  type BlockbusterContext,
} from './src/breakthroughBlockbusters';
let sequence = 0;
function unit(
  cardId = 'stockz',
  side: Side = 'player',
  lane: Lane = 0,
  hands?: number,
): Unit {
  const card = catalogCardById[cardId];
  assert.ok(card, cardId);
  return {
    id: `blockbuster-${++sequence}`,
    cardId,
    side,
    lane,
    position: side === 'player' ? 0.1 : 0.9,
    hands: hands ?? card.power,
    baseHands: card.power,
    maxHands: hands ?? card.power,
    squabbled: false,
    nextEffectAt: 999999,
  };
}
function action(
  cardId: keyof typeof BLOCKBUSTER_ADAPTERS,
  side: Side = 'player',
  lane: Lane = 0,
) {
  const source = unit(cardId, side, lane, 1);
  return source;
}
function harness(units: Unit[] = [], rolls: number[] = []) {
  const deck = BREAKTHROUGH_ROSTER.filter((card) => card.kind === 'character')
    .slice(0, 10)
    .map((card) => card.id);
  const state = createGame(BREAKTHROUGH_ROSTER, {
    seed: 45,
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
  state.units = units;
  for (const side of ['player', 'opponent'] as const) {
    state.players[side].hand = [];
    state.players[side].queue = [];
    state.players[side].motion = 5;
  }
  let randomCalls = 0;
  const event = (value: Omit<BattleEvent, 'id'>) =>
    state.events.push({ ...value, id: state.nextEventId++ });
  const reduce = (
    source: Unit,
    target: Unit,
    amount: number,
    defended: boolean,
  ): number => {
    if (defended && target.immune) return 0;
    if (defended && target.protected) {
      target.protected = false;
      return 0;
    }
    const actual = Math.min(target.hands, amount);
    target.hands -= actual;
    recordBlockbusterReduction(ctx, target, actual);
    event({
      type: 'damage',
      targetUnitId: target.id,
      side: target.side,
      lane: target.lane,
      amount: actual,
      text: `−${actual}`,
      sourceUnitId: source.id,
    });
    return actual;
  };
  const ctx: BlockbusterContext = {
    state,
    definition: (target) => {
      const card = catalogCardById[target.cardId];
      return {
        id: target.cardId,
        hands: card.power,
        kind: card.kind as FighterDefinition['kind'],
      };
    },
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
    damage: (source, target, amount) => reduce(source, target, amount, true),
    selfDamage: (source, target, amount) =>
      reduce(source, target, amount, false),
    sacrifice: (_source, target) => {
      state.units = state.units.filter((unit) => unit.id !== target.id);
    },
    protect: (target) => {
      target.protected = true;
    },
    cleanse: (target) => {
      target.frozen = target.silenced = target.weakened = false;
      target.burnStacks = 0;
      state.statuses = state.statuses.filter(
        (status) => status.targetId !== target.id,
      );
    },
    openForMove: (target, lane) =>
      !target.frozen &&
      target.lane !== lane &&
      !state.units.some(
        (enemy) =>
          enemy.side !== target.side &&
          enemy.lane === lane &&
          enemy.hands > 0 &&
          Math.abs(target.position - enemy.position) < 0.22,
      ),
    move: (target, lane) => {
      if (!ctx.openForMove(target, lane)) return false;
      target.lane = lane;
      return true;
    },
    burn: (_source, target, stacks, penalty) => {
      if (target.immune) return false;
      if (!penalty && target.protected) {
        target.protected = false;
        return false;
      }
      target.burnStacks = (target.burnStacks ?? 0) + stacks;
      return true;
    },
    draw: (side, count) => {
      const player = state.players[side];
      if (state.drawsLocked || state.elapsedMs >= state.durationMs - 30000)
        return 0;
      let drawn = 0;
      while (drawn < count && player.hand.length < 4 && player.queue.length) {
        player.hand.push(player.queue.shift()!);
        drawn++;
      }
      return drawn;
    },
    random: () => {
      const value = rolls[randomCalls] ?? ((randomCalls * 19 + 7) % 97) / 97;
      randomCalls++;
      return value;
    },
    event,
  };
  blockbusterTick(ctx);
  return { ctx, randomCalls: () => randomCalls };
}
test('all ten Blockbusters and Homeless Guy map canonical IDs to concrete authored effects', () => {
  assert.equal(Object.keys(BLOCKBUSTER_ADAPTERS).length, 11);
  for (const [id, adapter] of Object.entries(BLOCKBUSTER_ADAPTERS)) {
    assert.ok(catalogCardById[id]);
    assert.ok(BLOCKBUSTER_ABILITY_DESCRIPTIONS[adapter.ability].length > 70);
  }
  assert.equal(catalogCardById['the-shootout'].kind, 'blockbuster');
});
test('Shootout independently hits local enemies through defense rules, then direct-damages the strongest local ally', () => {
  const strong = unit('stockz', 'player', 0, 7),
    weak = unit('plug'),
    enemy = unit('stockz', 'opponent', 0, 5),
    shield = unit('stockz', 'opponent', 0, 6),
    remote = unit('stockz', 'opponent', 1, 9);
  strong.protected = true;
  shield.protected = true;
  const { ctx } = harness([strong, weak, enemy, shield, remote]);
  resolveBlockbuster(ctx, 'crossfire', action('the-shootout'));
  assert.equal(enemy.hands, 2);
  assert.equal(shield.hands, 6);
  assert.equal(shield.protected, false);
  assert.equal(strong.hands, 6);
  assert.equal(strong.protected, true);
  assert.equal(remote.hands, 9);
});
test('Block Spin repeats original hits three times, never records repeats, and multiple casts cannot amplify their own history', () => {
  const enemy = unit('stockz', 'opponent', 0, 30),
    { ctx } = harness([enemy]);
  ctx.damage(action('the-shootout'), enemy, 2);
  assert.equal(enemy.hands, 28);
  resolveBlockbuster(ctx, 'run-it-back-twice', action('the-block-spin'));
  assert.equal(enemy.hands, 22);
  assert.equal(ctx.state.blockbusters!.reductions.length, 1);
  resolveBlockbuster(ctx, 'run-it-back-twice', action('the-block-spin'));
  assert.equal(enemy.hands, 16);
  assert.equal(ctx.state.blockbusters!.reductions.length, 1);
});
test('Block Spin skips destroyed/departed targets and clears the ledger at a global pulse boundary', () => {
  const enemy = unit('stockz', 'opponent', 0, 9),
    remote = unit('stockz', 'opponent', 0, 8),
    { ctx } = harness([enemy, remote]);
  ctx.damage(action('the-shootout'), enemy, 1);
  ctx.damage(action('the-shootout'), remote, 1);
  remote.lane = 2;
  resolveBlockbuster(ctx, 'run-it-back-twice', action('the-block-spin'));
  assert.equal(enemy.hands, 5);
  assert.equal(remote.hands, 7);
  ctx.state.elapsedMs = 10000;
  blockbusterTick(ctx);
  resolveBlockbuster(ctx, 'run-it-back-twice', action('the-block-spin'));
  assert.equal(enemy.hands, 5);
  assert.equal(ctx.state.blockbusters!.reductions.length, 0);
});
test('Block Spin can replay opposing reductions against own fighters; direct damage does not consume friendly Protection', () => {
  const ally = unit('stockz', 'player', 0, 20),
    { ctx } = harness([ally]);
  ctx.damage(action('the-shootout', 'opponent'), ally, 2);
  ally.protected = true;
  resolveBlockbuster(ctx, 'run-it-back-twice', action('the-block-spin'));
  assert.equal(ally.hands, 12);
  assert.equal(ally.protected, true);
});
test('Sideshow moves both sides into legal weakest other lanes, buffs only successful friendlies, and leaves frozen cards', () => {
  const ally = unit('stockz'),
    enemy = unit('stockz', 'opponent'),
    frozen = unit('plug');
  frozen.frozen = true;
  const { ctx } = harness([ally, enemy, frozen]);
  const positions = [ally.position, enemy.position];
  resolveBlockbuster(ctx, 'clear-the-intersection', action('the-sideshow'));
  assert.notEqual(ally.lane, 0);
  assert.notEqual(enemy.lane, 0);
  assert.equal(frozen.lane, 0);
  assert.equal(ally.hands, catalogCardById.stockz.power + 2);
  assert.equal(enemy.hands, catalogCardById.stockz.power);
  assert.deepEqual([ally.position, enemy.position], positions);
});
test('Concert requires a real option, offers distinct hype/chaos results and never guesses a default', () => {
  const ally = unit('stockz'),
    enemy = unit('stockz', 'opponent'),
    { ctx } = harness([ally, enemy]);
  const before = JSON.stringify(ctx.state);
  assert.equal(
    resolveBlockbuster(ctx, 'crowd-control', action('the-concert')),
    false,
  );
  assert.equal(JSON.stringify(ctx.state), before);
  resolveBlockbuster(ctx, 'crowd-control', action('the-concert'), 'buff');
  assert.equal(ally.hands, 7);
  assert.equal(enemy.hands, 5);
  resolveBlockbuster(ctx, 'crowd-control', action('the-concert'), 'damage');
  assert.equal(ally.hands, 6);
  assert.equal(enemy.hands, 2);
});
test('Setup rejects fewer than two fighters atomically, sacrifices weakest current fighter and inherits current Hands+4', () => {
  const weak = unit('plug', 'player', 0, 2),
    strong = unit('stockz', 'player', 0, 7),
    { ctx } = harness([weak]);
  assert.equal(blockbusterLegal(ctx, 'trust-nobody', 'player', 0).valid, false);
  assert.equal(
    resolveBlockbuster(ctx, 'trust-nobody', action('the-setup')),
    false,
  );
  assert.equal(weak.hands, 2);
  ctx.state.units.push(strong);
  weak.immune = true;
  weak.protected = true;
  resolveBlockbuster(ctx, 'trust-nobody', action('the-setup'));
  assert.equal(
    ctx.state.units.some((unit) => unit.id === weak.id),
    false,
  );
  assert.equal(strong.hands, 13);
  assert.equal(strong.protected, true);
  assert.equal(ctx.state.blockbusters!.reductions.length, 0);
});
test('Dice validates the wager for both sides before any RNG or mutation', () => {
  const { ctx, randomCalls } = harness();
  ctx.state.players.opponent.motion = 1;
  const before = JSON.stringify(ctx.state);
  for (const choice of [undefined, '', '0', '4', '1.5', '2'])
    assert.equal(
      resolveBlockbuster(
        ctx,
        'best-two-of-three',
        action('the-dice-game'),
        choice,
      ),
      false,
    );
  assert.equal(randomCalls(), 0);
  assert.equal(JSON.stringify(ctx.state), before);
});
test('Dice sums the highest two, moves one pot, caps at nine, buffs only winner’s weakest local fighter', () => {
  const ally = unit('stockz', 'player', 0, 5),
    weak = unit('plug', 'player', 0, 2),
    enemy = unit('stockz', 'opponent', 0, 6),
    { ctx, randomCalls } = harness(
      [ally, weak, enemy],
      [0.99, 0.99, 0, 0.5, 0.5, 0.99],
    );
  ctx.state.players.player.motion = 8;
  ctx.state.players.opponent.motion = 5;
  resolveBlockbuster(ctx, 'best-two-of-three', action('the-dice-game'), '3');
  assert.equal(ctx.state.players.player.motion, 9);
  assert.equal(ctx.state.players.opponent.motion, 2);
  assert.equal(ally.hands, 5);
  assert.equal(weak.hands, 5);
  assert.equal(enemy.hands, 6);
  assert.equal(randomCalls(), 6);
  assert.deepEqual(ctx.state.blockbusters!.dice, {
    wager: 3,
    player: [6, 6, 1],
    opponent: [4, 4, 6],
    winner: 'player',
  });
});
test('Dice ties refund both wagers without buffs and a losing initiating player correctly pays the opponent', () => {
  const ally = unit('stockz'),
    { ctx } = harness([ally], [0, 0.5, 0.99, 0.99, 0.5, 0]);
  resolveBlockbuster(ctx, 'best-two-of-three', action('the-dice-game'), '2');
  assert.equal(ctx.state.players.player.motion, 5);
  assert.equal(ctx.state.players.opponent.motion, 5);
  assert.equal(ally.hands, 4);
  const enemy = unit('stockz', 'opponent'),
    losing = harness([enemy], [0, 0, 0, 0.99, 0.99, 0.99]).ctx;
  resolveBlockbuster(losing, 'best-two-of-three', action('the-dice-game'), '1');
  assert.equal(losing.state.players.player.motion, 4);
  assert.equal(losing.state.players.opponent.motion, 6);
  assert.equal(enemy.hands, 7);
});
test('After Party extends globally once and preserves Last Stand’s irreversible draw lock', () => {
  const ally = unit('stockz'),
    enemy = unit('stockz', 'opponent'),
    { ctx } = harness([ally, enemy]);
  ctx.state.elapsedMs = 151000;
  resolveBlockbuster(ctx, 'one-more-round', action('the-after-party'));
  assert.equal(ctx.state.durationMs, 190000);
  assert.equal(ctx.state.drawsLocked, true);
  assert.equal(ally.hands, 6);
  assert.equal(enemy.hands, 4);
  resolveBlockbuster(
    ctx,
    'one-more-round',
    action('the-after-party', 'opponent'),
  );
  assert.equal(ctx.state.durationMs, 190000);
  assert.equal(enemy.hands, 4);
});
test('Kickback moves available cards from both sides into destination without dragging frozen cards or granting idle buffs', () => {
  const ally = unit('stockz', 'player', 1),
    local = unit('plug'),
    enemy = unit('stockz', 'opponent', 2),
    frozen = unit('plug', 'player', 2);
  frozen.frozen = true;
  const { ctx } = harness([ally, local, enemy, frozen]);
  resolveBlockbuster(ctx, 'everybody-pull-up', action('the-kickback'));
  assert.equal(ally.lane, 0);
  assert.equal(ally.hands, 6);
  assert.equal(enemy.lane, 0);
  assert.equal(enemy.hands, 4);
  assert.equal(local.hands, catalogCardById.plug.power);
  assert.equal(frozen.lane, 2);
});
test('Cookout serves exactly three random-with-replacement meals, fully cleanses, then one deferred Burnt Plate clears once', () => {
  const ally = unit('stockz', 'player', 1);
  ally.frozen = ally.silenced = ally.weakened = true;
  ally.burnStacks = 3;
  ally.protected = true;
  const { ctx, randomCalls } = harness([ally], [0, 0, 0, 0, 0]);
  resolveBlockbuster(ctx, 'hot-plate', action('the-cookout'));
  assert.equal(ally.hands, 10);
  assert.equal(ally.burnStacks, 0);
  assert.equal(ally.silenced, false);
  assert.equal(ally.protected, true);
  assert.equal(randomCalls(), 4);
  assert.equal(ctx.state.blockbusters!.plates.length, 1);
  ctx.state.elapsedMs = 9999;
  blockbusterTick(ctx);
  assert.equal(ally.burnStacks, 0);
  ctx.state.elapsedMs = 10000;
  blockbusterTick(ctx);
  assert.equal(ally.burnStacks, 1);
  assert.equal(ally.protected, true);
  assert.equal(ctx.state.blockbusters!.plates.length, 0);
  blockbusterTick(ctx);
  assert.equal(ally.burnStacks, 1);
});
test('Cookout Burnt Plate respects immunity, picks only surviving local friendlies, and never creates an attacking token', () => {
  const ally = unit('stockz', 'player', 1),
    enemy = unit('stockz', 'opponent', 1),
    { ctx } = harness([ally, enemy]);
  ally.immune = true;
  resolveBlockbuster(ctx, 'hot-plate', action('the-cookout'));
  ctx.state.elapsedMs = 10000;
  blockbusterTick(ctx);
  assert.equal(ally.burnStacks ?? 0, 0);
  assert.equal(enemy.burnStacks ?? 0, 0);
  assert.equal(ctx.state.units.length, 2);
});
test('Baby Shower buffs local crew, draws real queue cards to hand cap, and never draws after Last Stand', () => {
  const ally = unit('stockz'),
    remote = unit('plug', 'player', 1),
    { ctx } = harness([ally, remote]);
  ctx.state.players.player.hand = ['hooper', 'plug', 'stockz'];
  ctx.state.players.player.queue = ['gamer', 'wiretap'];
  resolveBlockbuster(ctx, 'new-blessings', action('the-babyshower'));
  assert.equal(ally.hands, 7);
  assert.equal(remote.hands, catalogCardById.plug.power);
  assert.deepEqual(ctx.state.players.player.hand, [
    'hooper',
    'plug',
    'stockz',
    'gamer',
  ]);
  assert.deepEqual(ctx.state.players.player.queue, ['wiretap']);
  ctx.state.players.player.hand = [];
  ctx.state.elapsedMs = 150000;
  resolveBlockbuster(ctx, 'new-blessings', action('the-babyshower'));
  assert.deepEqual(ctx.state.players.player.hand, []);
});
test('Homeless Guy invests explicit 0–4 only, adds one bonus for positive investments, and steals only actual defended damage when base cost emptied wallet', () => {
  const guy = unit('homeless-guy'),
    enemy = unit('stockz', 'opponent', 0, 1),
    { ctx } = harness([guy, enemy]);
  homelessInvestment(ctx, guy, '0', false);
  assert.equal(guy.hands, 4);
  homelessInvestment(ctx, guy, '4', false);
  assert.equal(guy.hands, 9);
  assert.throws(() => homelessInvestment(ctx, guy, '5', false));
  homelessInvestment(ctx, guy, '0', true);
  assert.equal(enemy.hands, 0);
  assert.equal(guy.hands, 10);
  const protectedEnemy = unit('stockz', 'opponent', 0, 9);
  protectedEnemy.protected = true;
  ctx.state.units.push(protectedEnemy);
  homelessInvestment(ctx, guy, '0', true);
  assert.equal(guy.hands, 10);
  assert.equal(protectedEnemy.hands, 9);
});
test('Blockbuster state clones do not share repeat history, plate sources or dice arrays with replay branches', () => {
  const ally = unit('stockz'),
    { ctx } = harness([ally]);
  resolveBlockbuster(ctx, 'hot-plate', action('the-cookout'));
  recordBlockbusterReduction(ctx, ally, 1);
  resolveBlockbuster(ctx, 'best-two-of-three', action('the-dice-game'), '1');
  const before = JSON.stringify(ctx.state.blockbusters),
    cloned = cloneBlockbusterState(ctx.state.blockbusters)!;
  cloned.reductions[0].amount = 20;
  cloned.plates[0].source.lane = 2;
  cloned.dice!.player[0] = 9;
  assert.equal(JSON.stringify(ctx.state.blockbusters), before);
  assert.equal(cloneBlockbusterState(undefined), undefined);
});

function actualState(units: Unit[] = []) {
  const deck = BREAKTHROUGH_ROSTER.filter((card) => card.kind === 'character')
    .slice(0, 10)
    .map((card) => card.id);
  const state = createGame(BREAKTHROUGH_ROSTER, {
    seed: 76,
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
  state.units = units;
  for (const side of ['player', 'opponent'] as const) {
    state.players[side].motion = 9;
    state.players[side].hand = [];
    state.players[side].queue = [];
    state.players[side].returns = [];
  }
  return state;
}
function actualPlay(
  state: ReturnType<typeof actualState>,
  id: string,
  lane: Lane = 0,
  choice?: string,
  side: Side = 'player',
) {
  state.players[side].hand = [id];
  const result = deploy(
    state,
    side,
    id,
    lane,
    false,
    choice === undefined ? undefined : { choice },
  );
  assert.equal(result.error, undefined, `${id} executes through core deploy`);
  return result.state;
}
test('core Blockbusters are actions with no marching unit, no breach, one paid command and normal delayed return', () => {
  const foe = unit('stockz', 'opponent', 0, 9),
    state = actualState([foe]);
  const next = actualPlay(state, 'the-shootout');
  assert.equal(next.units.length, 1);
  assert.equal(next.units[0].hands, 6);
  assert.equal(next.players.player.motion, 6);
  assert.equal(next.players.player.breaches, 0);
  assert.equal(
    next.players.player.returns.filter((card) => card.cardId === 'the-shootout')
      .length,
    1,
  );
  assert.equal(next.commands.at(-1)!.cardId, 'the-shootout');
});
test('core Concert rejects missing/malformed choices atomically and stores the explicit choice for deterministic replay', () => {
  const ally = unit('stockz'),
    foe = unit('stockz', 'opponent'),
    state = actualState([ally, foe]);
  state.players.player.hand = ['the-concert'];
  const plan = deploymentChoices(state, 'player', 'the-concert', 0);
  assert.equal(plan.required, true);
  assert.deepEqual(
    plan.options.map((option) => option.value),
    ['buff', 'damage'],
  );
  const before = JSON.stringify(state);
  for (const choice of [undefined, '0', 'auto', 'BUFF']) {
    const result = deploy(
      state,
      'player',
      'the-concert',
      0,
      false,
      choice === undefined ? undefined : { choice },
    );
    assert.ok(result.error);
    assert.equal(result.state, state);
    assert.equal(JSON.stringify(state), before);
  }
  const applied = deploy(state, 'player', 'the-concert', 0, false, {
    choice: 'damage',
  });
  assert.equal(applied.error, undefined);
  assert.equal(
    applied.state.units.find((unit) => unit.id === ally.id)!.hands,
    3,
  );
  assert.equal(
    applied.state.units.find((unit) => unit.id === foe.id)!.hands,
    1,
  );
  assert.deepEqual(applied.state.commands.at(-1)!.target, { choice: 'damage' });
  assert.deepEqual(
    replayCommand(state, applied.state.commands.at(-1)!),
    applied,
  );
});
test('core Homeless Guy pays chosen investment once and distinguishes base-cost empty-wallet from extra-cost exhaustion', () => {
  const foe = unit('stockz', 'opponent', 0, 8);
  let state = actualState([foe]);
  state.players.player.motion =
    deploymentCost(state, 'player', 'homeless-guy', 0) + 4;
  state = actualPlay(state, 'homeless-guy', 0, '4');
  assert.equal(state.players.player.motion, 0);
  assert.equal(
    state.units.find((unit) => unit.cardId === 'homeless-guy')!.hands,
    catalogCardById['homeless-guy'].power + 5,
  );
  assert.equal(state.units.find((unit) => unit.id === foe.id)!.hands, 8);
  const enemy = unit('stockz', 'opponent', 0, 8);
  let empty = actualState([enemy]);
  empty.players.player.motion = deploymentCost(
    empty,
    'player',
    'homeless-guy',
    0,
  );
  empty = actualPlay(empty, 'homeless-guy', 0, '0');
  assert.equal(empty.units.find((unit) => unit.id === enemy.id)!.hands, 6);
  assert.equal(
    empty.units.find((unit) => unit.cardId === 'homeless-guy')!.hands,
    catalogCardById['homeless-guy'].power + 2,
  );
});
test('core wager is revalidated against both wallets; rejected stale choices do not charge, mutate RNG, or consume the card', () => {
  const state = actualState();
  state.players.player.hand = ['the-dice-game'];
  state.players.player.motion = state.players.opponent.motion = 3;
  assert.equal(
    deploymentChoices(state, 'player', 'the-dice-game', 0).options.find(
      (option) => option.value === '3',
    )!.disabled,
    false,
  );
  state.players.opponent.motion = 2;
  const before = JSON.stringify(state),
    bad = deploy(state, 'player', 'the-dice-game', 0, false, { choice: '3' });
  assert.ok(bad.error);
  assert.equal(bad.state, state);
  assert.equal(JSON.stringify(state), before);
  const good = deploy(state, 'player', 'the-dice-game', 0, false, {
    choice: '2',
  });
  assert.equal(good.error, undefined);
  assert.equal(good.state.units.length, 0);
  assert.notEqual(good.state.effectsRng, state.effectsRng);
  assert.deepEqual(replayCommand(state, good.state.commands.at(-1)!), good);
});
test('core damage history records actual crossfire packets once and Block Spin repeats without exponential history', () => {
  const ally = unit('stockz', 'player', 0, 20),
    enemy = unit('stockz', 'opponent', 0, 30);
  let state = actualState([ally, enemy]);
  state = actualPlay(state, 'the-shootout');
  state = actualPlay(state, 'the-block-spin');
  assert.equal(state.units.find((unit) => unit.id === ally.id)!.hands, 16);
  assert.equal(state.units.find((unit) => unit.id === enemy.id)!.hands, 18);
  assert.equal(state.blockbusters!.reductions.length, 2);
  state.players.player.motion = 9;
  state = actualPlay(state, 'the-block-spin');
  assert.equal(state.units.find((unit) => unit.id === enemy.id)!.hands, 9);
  assert.equal(state.blockbusters!.reductions.length, 2);
});
test('core After Party cannot reopen stopped draws or extend twice across opposing players', () => {
  let state = actualState([unit('stockz')]);
  state.elapsedMs = 149950;
  state = advance(state, 50);
  assert.equal(state.drawsLocked, true);
  state.players.player.queue = ['plug', 'wiretap'];
  state = actualPlay(state, 'the-after-party');
  assert.equal(state.durationMs, 190000);
  state = advance(state, 1000);
  assert.equal(state.players.player.hand.length, 0);
  state.players.opponent.motion = 9;
  state = actualPlay(state, 'the-after-party', 0, undefined, 'opponent');
  assert.equal(state.durationMs, 190000);
  assert.equal(state.drawsLocked, true);
});
