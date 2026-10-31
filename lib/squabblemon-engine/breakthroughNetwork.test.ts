import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cardCatalog } from './src/data';
import { BREAKTHROUGH_ROSTER } from './src/breakthroughCatalog';
import {
  cloneSupportRuntime,
  createSupportRuntime,
  supportProtectionConsumed,
  type SupportTools,
} from './src/breakthroughSupports';
import {
  advance,
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
import {
  NETWORK_ADAPTERS,
  NETWORK_ABILITY_DESCRIPTIONS,
  cloneNetworkState,
  networkDiscount,
  networkEntrance,
  networkInterrupted,
  networkMoved,
  networkPlayed,
  networkRefill,
  networkSpendDiscount,
  networkTick,
  type NetworkContext,
} from './src/breakthroughNetwork';

const seats: Side[] = ['player', 'opponent'];
const cards = [
  ...Object.keys(NETWORK_ADAPTERS),
  'hooper',
  'plug',
  'bus-pass',
  'gamer',
];
const roster: FighterDefinition[] = BREAKTHROUGH_ROSTER.filter((card) =>
  cards.includes(card.id),
);
let serial = 0;
function fighter(
  id: string,
  side: Side = 'player',
  lane: Lane = 0,
  hands?: number,
): Unit {
  const card = roster.find((card) => card.id === id)!;
  return {
    id: `network-${++serial}`,
    cardId: id,
    side,
    lane,
    position: side === 'player' ? 0.2 : 0.8,
    hands: hands ?? card.hands,
    baseHands: card.hands,
    maxHands: hands ?? card.hands,
    nextEffectAt: 999999,
    squabbled: false,
  };
}
function harness(units: Unit[] = []) {
  const state = createGame(roster, {
    decks: { player: cards.slice(0, 10), opponent: cards.slice(0, 10) },
    travelMs: 1e9,
  });
  state.units = units;
  state.players.player.hand = [];
  state.players.opponent.hand = [];
  const event = (event: Omit<BattleEvent, 'id'>) => {
    state.events.push({ ...event, id: state.nextEventId++ });
  };
  const ctx: NetworkContext = {
    state,
    definition: (unit) => roster.find((card) => card.id === unit.cardId)!,
    active: (unit) => unit.hands > 0 && !unit.silenced && !unit.weakened,
    power: (unit) => (unit.frozen ? 0 : unit.hands),
    gain: (unit, amount) => {
      if (unit.hands <= 0) return;
      unit.hands += amount;
      unit.maxHands += amount;
      event({
        type: 'buff',
        side: unit.side,
        lane: unit.lane,
        amount,
        text: `+${amount}`,
      });
    },
    refund: (side, amount, source) => {
      const actual = Math.min(amount, 9 - state.players[side].motion);
      state.players[side].motion += actual;
      event({
        type: 'motion',
        side,
        amount: actual,
        sourceUnitId: source.id,
        text: `+${actual} MOTION`,
      });
      return actual;
    },
    weaken: (source, target) => {
      if (target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      const newlyApplied = !target.weakened;
      target.weakened = true;
      networkInterrupted(ctx, source, target, 'weaken', newlyApplied);
      return newlyApplied;
    },
    openForMove: (unit, lane) =>
      !unit.frozen &&
      unit.lane !== lane &&
      !state.units.some(
        (enemy) =>
          enemy.side !== unit.side &&
          enemy.lane === lane &&
          enemy.hands > 0 &&
          Math.abs(enemy.position - unit.position) < 0.22,
      ),
    move: (unit, lane) => {
      if (!ctx.openForMove(unit, lane)) return false;
      unit.lane = lane;
      networkMoved(ctx, unit);
      return true;
    },
    event,
  };
  networkTick(ctx);
  return ctx;
}
function card(id: string) {
  return roster.find((card) => card.id === id)!;
}
function played(
  ctx: NetworkContext,
  id: string,
  side: Side = 'player',
  lane: Lane = 0,
) {
  const entrant =
    card(id).kind === 'support' ? undefined : fighter(id, side, lane);
  if (entrant) ctx.state.units.push(entrant);
  networkPlayed(ctx, side, card(id), lane, entrant);
  return entrant;
}
function time(ctx: NetworkContext, ms: number) {
  ctx.state.elapsedMs = ms;
  networkTick(ctx);
}

test('all ten adapters reference canonical cards and concrete mechanics', () => {
  assert.equal(Object.keys(NETWORK_ADAPTERS).length, 10);
  for (const [id, adapter] of Object.entries(NETWORK_ADAPTERS)) {
    assert.ok(cardCatalog.some((card) => card.catalogId === id));
    assert.ok(NETWORK_ABILITY_DESCRIPTIONS[adapter.ability].length > 70);
  }
  assert.equal(card('battery-back').name, 'Game Developer');
  assert.equal(card('wiretap').hands, 1);
  assert.equal(card('livewire').hands, 3);
});
test('Follower Frenzy shares two triggers, excludes self/expensive cards/actions, and never stacks watchers', () => {
  const streamer = fighter('live-streamer'),
    second = fighter('live-streamer');
  const ctx = harness([streamer, second]);
  networkEntrance(ctx, streamer);
  played(ctx, 'stockz');
  played(ctx, 'bus-pass');
  const first = played(ctx, 'plug')!,
    next = played(ctx, 'plug')!,
    third = played(ctx, 'plug')!;
  assert.equal(first.hands, card('plug').hands + 1);
  assert.equal(next.hands, card('plug').hands + 1);
  assert.equal(third.hands, card('plug').hands);
  assert.equal(streamer.hands, card('live-streamer').hands);
});
test('Follower Frenzy expires after ten seconds and requires an active watcher; reveal resets shared budget', () => {
  const streamer = fighter('live-streamer');
  const ctx = harness([streamer]);
  networkEntrance(ctx, streamer);
  streamer.silenced = true;
  assert.equal(played(ctx, 'plug')!.hands, card('plug').hands);
  streamer.silenced = false;
  assert.equal(played(ctx, 'plug')!.hands, card('plug').hands + 1);
  time(ctx, 10000);
  assert.equal(played(ctx, 'plug')!.hands, card('plug').hands);
  networkEntrance(ctx, streamer);
  assert.equal(played(ctx, 'plug')!.hands, card('plug').hands + 1);
});
test('STOCKZ compounds later characters only while active, without ghost triggers after departure', () => {
  const stockz = fighter('stockz');
  const ctx = harness([stockz]);
  networkPlayed(ctx, 'player', card('stockz'), 0, stockz);
  assert.equal(stockz.hands, 4);
  played(ctx, 'plug', 'player', 2);
  assert.equal(stockz.hands, 5);
  played(ctx, 'bus-pass');
  networkMoved(ctx, stockz);
  assert.equal(stockz.hands, 5);
  stockz.weakened = true;
  played(ctx, 'plug');
  assert.equal(stockz.hands, 5);
  stockz.weakened = false;
  ctx.state.units = ctx.state.units.filter((unit) => unit.id !== stockz.id);
  played(ctx, 'plug');
  assert.equal(stockz.hands, 5);
});
test('City Tour buffs exactly the weakest ally in each other lane and leaves local allies unchanged', () => {
  const gamer = fighter('gamer'),
    local = fighter('plug'),
    low = fighter('plug', 'player', 1, 1),
    high = fighter('plug', 'player', 1, 8),
    other = fighter('plug', 'player', 2, 3);
  const ctx = harness([gamer, local, low, high, other]);
  networkEntrance(ctx, gamer);
  assert.equal(local.hands, card('plug').hands);
  assert.equal(low.hands, 3);
  assert.equal(high.hands, 8);
  assert.equal(other.hands, 5);
});
test('Gamer control rewards only new hostile interruptions once per global pulse, scoped to the acting side', () => {
  for (const side of seats) {
    const enemySide = side === 'player' ? 'opponent' : 'player';
    const gamer = fighter('gamer', side),
      actor = fighter('plug', side),
      enemy = fighter('plug', enemySide);
    const ctx = harness([gamer, actor, enemy]);
    networkInterrupted(ctx, actor, enemy, 'silence', false);
    assert.equal(gamer.hands, 1);
    networkInterrupted(ctx, actor, actor, 'weaken', true);
    assert.equal(gamer.hands, 1);
    networkInterrupted(ctx, actor, enemy, 'silence', true);
    assert.equal(gamer.hands, 3);
    networkInterrupted(ctx, actor, enemy, 'weaken', true);
    assert.equal(gamer.hands, 3);
    time(ctx, 10000);
    networkInterrupted(ctx, actor, enemy, 'weaken', true);
    assert.equal(gamer.hands, 5);
    gamer.silenced = true;
    time(ctx, 20000);
    networkInterrupted(ctx, actor, enemy, 'weaken', true);
    assert.equal(gamer.hands, 5);
  }
});
test('held Gamer follows global pulses through Last Stand and stops immediately on leaving hand', () => {
  const dark = fighter('gamer'),
    nonDark = fighter('plug');
  const ctx = harness([dark, nonDark]);
  ctx.state.players.player.hand = ['gamer'];
  time(ctx, 9999);
  assert.equal(dark.hands, 1);
  time(ctx, 10000);
  assert.equal(dark.hands, 2);
  assert.equal(nonDark.hands, card('plug').hands);
  time(ctx, 10000);
  assert.equal(dark.hands, 2);
  ctx.state.elapsedMs = 149999;
  networkTick(ctx);
  const before = dark.hands;
  time(ctx, 150000);
  assert.equal(dark.hands, before + 1);
  ctx.state.players.player.hand = [];
  time(ctx, 160000);
  assert.equal(dark.hands, before + 1);
});
test('Boss Bae counts the paid lane, supports included; two gains arm one expensive-card discount', () => {
  const boss = fighter('boss-babe', 'player', 1),
    ctx = harness([boss]);
  played(ctx, 'plug', 'player', 1);
  assert.equal(boss.hands, 3);
  played(ctx, 'bus-pass', 'player', 0);
  assert.equal(boss.hands, 4);
  played(ctx, 'plug', 'player', 2);
  assert.equal(boss.hands, 5);
  played(ctx, 'plug', 'player', 2);
  assert.equal(boss.hands, 5);
  assert.equal(networkDiscount(ctx, 'player', card('plug'), 1), undefined);
  const quote = networkDiscount(ctx, 'player', card('circuit-captain'), 1)!;
  assert.equal(quote.kind, 'four-plus');
  assert.equal(
    networkSpendDiscount(ctx, 'player', quote.id, card('circuit-captain'), 1),
    0,
  );
  assert.equal(
    networkDiscount(ctx, 'player', card('circuit-captain'), 1),
    undefined,
  );
});
test('Burn Rate borrows only capacity once per side/match and repays available Motion at the pulse', () => {
  const tech = fighter('techbro-rich'),
    ctx = harness([tech]);
  ctx.state.players.player.motion = 8.5;
  networkEntrance(ctx, tech);
  assert.equal(ctx.state.players.player.motion, 9);
  ctx.state.players.player.motion = 3;
  time(ctx, 10000);
  assert.equal(ctx.state.players.player.motion, 2.5);
  networkEntrance(ctx, tech);
  assert.equal(ctx.state.players.player.motion, 2.5);
  assert.equal(networkRefill(ctx, 'player', 0.025), 0.025);
});
test('Burn Rate unpaid debt absorbs natural refill deterministically; cap-zero and recycled reveals do not rearm', () => {
  const tech = fighter('techbro-rich'),
    ctx = harness([tech]);
  ctx.state.players.player.motion = 0;
  networkEntrance(ctx, tech);
  ctx.state.players.player.motion = 0;
  time(ctx, 10000);
  assert.equal(networkRefill(ctx, 'player', 0.25), 0);
  assert.equal(networkRefill(ctx, 'player', 0.8), 0.05);
  assert.equal(networkRefill(ctx, 'player', 0.025), 0.025);
  networkEntrance(ctx, fighter('techbro-rich'));
  assert.equal(ctx.state.players.player.motion, 0);
  const capped = harness([tech]);
  capped.state.players.player.motion = 9;
  networkEntrance(capped, tech);
  capped.state.players.player.motion = 0;
  networkEntrance(capped, tech);
  assert.equal(capped.state.players.player.motion, 0);
});
test('Sneaker Reseller uses highest current Hands but copies only printed Hands capped at three; protection blocks only Weaken', () => {
  const sneaker = fighter('sneaker-reseller'),
    smallPrinted = fighter('wiretap', 'opponent', 2, 20),
    highPrinted = fighter('stockz', 'opponent', 0, 8);
  const ctx = harness([sneaker, smallPrinted, highPrinted]);
  networkEntrance(ctx, sneaker);
  assert.equal(sneaker.hands, card('sneaker-reseller').hands + 1);
  assert.equal(smallPrinted.weakened, true);
  assert.equal(highPrinted.weakened, undefined);
  const defended = fighter('stockz', 'opponent', 1, 9);
  defended.protected = true;
  const again = fighter('sneaker-reseller'),
    guarded = harness([again, defended]);
  networkEntrance(guarded, again);
  assert.equal(again.hands, card('sneaker-reseller').hands + 3);
  assert.equal(defended.weakened, undefined);
  assert.equal(defended.protected, false);
});
test('Game Developer repairs only negative modifiers in another lane, never ordinary damage; Motion refund is conditional/capped', () => {
  const dev = fighter('battery-back'),
    damaged = fighter('stockz', 'player', 1),
    reduced = fighter('plug', 'player', 2);
  damaged.hands = 1;
  damaged.damageTaken = 3;
  reduced.hands = 1;
  reduced.maxHands = reduced.baseHands - 1;
  const ctx = harness([dev, damaged, reduced]);
  ctx.state.players.player.motion = 8.5;
  networkEntrance(ctx, dev);
  assert.equal(reduced.hands, 2);
  assert.equal(damaged.hands, 1);
  assert.equal(ctx.state.players.player.motion, 9);
  ctx.state.players.player.motion = 4;
  ctx.state.units = [dev, damaged];
  networkEntrance(ctx, dev);
  assert.equal(ctx.state.players.player.motion, 4);
});
test('Foreman jobs accept two different other Electric instances via plays or moves, then refund once', () => {
  const foreman = fighter('circuit-captain'),
    worker = fighter('plug', 'player', 1),
    ctx = harness([foreman, worker]);
  ctx.state.players.player.motion = 3;
  networkEntrance(ctx, foreman);
  networkMoved(ctx, foreman);
  assert.equal(foreman.hands, 4);
  networkMoved(ctx, worker);
  networkMoved(ctx, worker);
  assert.equal(worker.hands, card('plug').hands + 1);
  played(ctx, 'hooper');
  assert.equal(ctx.state.players.player.motion, 3);
  const second = played(ctx, 'wiretap')!;
  assert.equal(second.hands, card('wiretap').hands + 1);
  assert.equal(ctx.state.players.player.motion, 4);
  networkMoved(ctx, second);
  assert.equal(ctx.state.players.player.motion, 4);
});
test('Foreman job contract survives source removal but expires at the second next pulse; repost replaces outstanding workers', () => {
  const foreman = fighter('circuit-captain'),
    worker = fighter('plug'),
    ctx = harness([foreman, worker]);
  networkEntrance(ctx, foreman);
  ctx.state.units = [worker];
  networkMoved(ctx, worker);
  assert.equal(worker.hands, card('plug').hands + 1);
  time(ctx, 20000);
  const expired = played(ctx, 'wiretap')!;
  assert.equal(expired.hands, card('wiretap').hands);
  ctx.state.units.push(foreman);
  networkEntrance(ctx, foreman);
  networkMoved(ctx, worker);
  networkEntrance(ctx, foreman);
  networkMoved(ctx, worker);
  assert.equal(worker.hands, card('plug').hands + 3);
});
test('Wiretap discount snapshots origin, quotes without mutation, consumes one eligible token atomically', () => {
  const wire = fighter('wiretap', 'player', 1),
    ctx = harness([wire]);
  networkEntrance(ctx, wire);
  assert.equal(networkDiscount(ctx, 'player', card('plug'), 1), undefined);
  const quote = networkDiscount(ctx, 'player', card('plug'), 0)!;
  assert.equal(networkDiscount(ctx, 'player', card('plug'), 0)!.id, quote.id);
  wire.lane = 0;
  assert.equal(
    networkSpendDiscount(ctx, 'player', quote.id + 1, card('plug'), 0),
    0,
  );
  assert.ok(networkDiscount(ctx, 'player', card('plug'), 0));
  networkSpendDiscount(ctx, 'player', quote.id, card('plug'), 0);
  assert.equal(networkDiscount(ctx, 'player', card('plug'), 0), undefined);
});
test('Livewire moves to the weakest legal other lane and snapshots destination for its character-only reward', () => {
  const live = fighter('livewire', 'player', 0),
    ally = fighter('stockz', 'player', 1, 8),
    ctx = harness([live, ally]);
  networkEntrance(ctx, live);
  assert.equal(live.lane, 2);
  assert.equal(live.hands, card('livewire').hands + 1);
  assert.equal(networkDiscount(ctx, 'player', card('plug'), 2), undefined);
  const quote = networkDiscount(ctx, 'player', card('plug'), 0)!;
  assert.equal(
    networkSpendDiscount(ctx, 'player', quote.id, card('plug'), 0),
    1,
  );
  networkEntrance(ctx, live);
  const action = networkDiscount(ctx, 'player', card('bus-pass'), 2)!;
  assert.equal(
    networkSpendDiscount(ctx, 'player', action.id, card('bus-pass'), 2),
    0,
  );
});
test('frozen Livewire has no legal move and gains neither Hands nor a discount', () => {
  const live = fighter('livewire');
  live.frozen = true;
  const ctx = harness([live]);
  networkEntrance(ctx, live);
  assert.equal(live.lane, 0);
  assert.equal(live.hands, card('livewire').hands);
  assert.equal(networkDiscount(ctx, 'player', card('plug'), 1), undefined);
});
test('serialized Network state deep clone prevents replay branches sharing counters, jobs, debt or tokens', () => {
  const boss = fighter('boss-babe'),
    foreman = fighter('circuit-captain'),
    wire = fighter('wiretap');
  const ctx = harness([boss, foreman, wire]);
  networkEntrance(ctx, foreman);
  networkEntrance(ctx, wire);
  played(ctx, 'plug', 'player', 1);
  const cloned = cloneNetworkState(ctx.state.network)!;
  const before = JSON.stringify(ctx.state.network);
  cloned.seats.player.jobs!.workers.push('different');
  cloned.seats.player.bossCounts[boss.id] = 40;
  cloned.seats.player.discounts[0].origin = 2;
  cloned.seats.player.debt = 8;
  assert.equal(JSON.stringify(ctx.state.network), before);
  assert.deepEqual(cloneNetworkState(undefined), undefined);
});

function coreState(units: Unit[] = []) {
  const state = createGame(BREAKTHROUGH_ROSTER, {
    seed: 52,
    travelMs: 1e9,
    decks: { player: cards.slice(0, 10), opponent: cards.slice(0, 10) },
  });
  state.units = units;
  for (const side of seats) {
    state.players[side].hand = [];
    state.players[side].queue = [];
    state.players[side].returns = [];
    state.players[side].motion = 9;
  }
  return state;
}
function corePlay(
  state: ReturnType<typeof coreState>,
  id: string,
  side: Side = 'player',
  lane: Lane = 0,
) {
  state.players[side].hand = [id];
  const result = deploy(state, side, id, lane);
  assert.equal(
    result.error,
    undefined,
    `${id} deploys through actual core command`,
  );
  return result.state;
}
test('core commands apply Streamer/STOCKZ ordering and retain exact deterministic replay without mutating the input branch', () => {
  let state = coreState();
  state = corePlay(state, 'stockz');
  state = corePlay(state, 'live-streamer', 'player', 1);
  state.players.player.hand = ['plug'];
  state.players.player.motion = 9;
  const before = JSON.stringify(state);
  const result = deploy(state, 'player', 'plug', 2);
  assert.equal(result.error, undefined);
  assert.equal(JSON.stringify(state), before);
  assert.equal(
    result.state.units.find((unit) => unit.cardId === 'plug')!.hands,
    card('plug').hands + 1,
  );
  assert.equal(
    result.state.units.find((unit) => unit.cardId === 'stockz')!.hands,
    card('stockz').hands + 2,
  );
  const replayed = replayCommand(state, result.state.commands.at(-1)!);
  assert.deepEqual(replayed, result);
});
test('core Ongoing metadata lets Closet Nerd select Gamer/STOCKZ and blocks their new triggers during Silence', () => {
  const gamer = fighter('gamer', 'opponent', 0, 10),
    stockz = fighter('stockz', 'opponent', 0, 8);
  let state = coreState([gamer, stockz]);
  state = corePlay(state, 'closet-nerd');
  const interrupted = state.units.find((unit) => unit.id === gamer.id)!;
  assert.equal(interrupted.silenced, true);
  assert.notEqual(
    state.units.find((unit) => unit.id === stockz.id)!.silenced,
    true,
  );
  assert.equal(
    state.units.find((unit) => unit.cardId === 'closet-nerd')!.hands,
    BREAKTHROUGH_ROSTER.find((card) => card.id === 'closet-nerd')!.hands + 1,
  );
  state.players.opponent.motion = 9;
  state = corePlay(state, 'plug', 'opponent', 2);
  assert.equal(state.units.find((unit) => unit.id === stockz.id)!.hands, 9);
  assert.equal(state.units.find((unit) => unit.id === gamer.id)!.hands, 10);
});
test('core defended status pipeline gives Gamer its first new enemy Weaken reward but not status extension', () => {
  const gamer = fighter('gamer'),
    enemy = fighter('stockz', 'opponent', 2, 10);
  let state = coreState([gamer, enemy]);
  state = corePlay(state, 'sneaker-reseller', 'player', 1);
  assert.equal(state.units.find((unit) => unit.id === gamer.id)!.hands, 3);
  assert.ok(
    state.statuses.some(
      (status) => status.targetId === enemy.id && status.kind === 'weaken',
    ),
  );
  state.players.player.motion = 9;
  state = corePlay(state, 'sneaker-reseller', 'player', 1);
  assert.equal(state.units.find((unit) => unit.id === gamer.id)!.hands, 3);
});
test('core Burn Rate tick settles debt before natural refill and never stalls clock or deployments', () => {
  let state = coreState();
  state.elapsedMs = 9950;
  state = corePlay(state, 'techbro-rich');
  state.players.player.motion = 0;
  state = advance(state, 1000);
  assert.equal(state.elapsedMs, 10950);
  assert.equal(state.players.player.motion, 0);
  assert.equal(state.network!.seats.player.debt, 0.5);
  state = advance(state, 1050);
  assert.equal(state.network!.seats.player.debt, 0);
  assert.equal(state.players.player.motion, 0.025);
});
test('core quoted discounts reject unaffordable input atomically and spend exactly one on a legal Livewire character play', () => {
  let state = coreState();
  state = corePlay(state, 'livewire', 'player', 0);
  const destination = state.units.find(
    (unit) => unit.cardId === 'livewire',
  )!.lane;
  const lane = destination === 0 ? 1 : 0;
  state.players.player.hand = ['plug'];
  state.players.player.motion = 0;
  const price = deploymentCost(state, 'player', 'plug', lane);
  assert.equal(price, Math.max(0, card('plug').cost - 1));
  assert.ok(price > 0);
  const before = JSON.stringify(state),
    refused = deploy(state, 'player', 'plug', lane);
  assert.equal(refused.error, 'Not enough Motion');
  assert.equal(refused.state, state);
  assert.equal(JSON.stringify(state), before);
  state.players.player.motion = price;
  const legal = deploy(state, 'player', 'plug', lane);
  assert.equal(legal.error, undefined);
  assert.equal(legal.state.players.player.motion, 0);
  assert.equal(
    legal.state.units.find((unit) => unit.cardId === 'plug')!.hands,
    card('plug').hands + 1,
  );
  assert.equal(legal.state.network!.seats.player.discounts.length, 0);
});

test('Network strongest/weakest targets use shared effective Hands, including Freeze', () => {
  const gamer = fighter('gamer'),
    frozen = fighter('stockz', 'player', 1, 8),
    low = fighter('plug', 'player', 1, 1);
  frozen.frozen = true;
  const ctx = harness([gamer, frozen, low]);
  networkEntrance(ctx, gamer);
  assert.equal(frozen.hands, 10);
  assert.equal(low.hands, 1);
  const sneaker = fighter('sneaker-reseller'),
    icedEnemy = fighter('stockz', 'opponent', 2, 20),
    enemy = fighter('plug', 'opponent', 0, 5);
  icedEnemy.frozen = true;
  const other = harness([sneaker, icedEnemy, enemy]);
  networkEntrance(other, sneaker);
  assert.equal(enemy.weakened, true);
  assert.notEqual(icedEnemy.weakened, true);
});

test('Network ignores stationary resources for targets and lane strength even if their raw Hands dwarf actual fighters', () => {
  const gamer = fighter('gamer'),
    ally = fighter('plug', 'player', 1, 3);
  const resource = {
    ...fighter('plug', 'player', 1, 0.5),
    cardId: 'demario-mushroom',
    canFight: false,
  };
  const ctx = harness([gamer, ally, resource]);
  networkEntrance(ctx, gamer);
  assert.equal(ally.hands, 5);
  assert.equal(resource.hands, 0.5);
  const live = fighter('livewire'),
    enormous = { ...resource, id: 'resource-heavy', hands: 100, maxHands: 100 };
  const move = harness([live, enormous]);
  networkEntrance(move, live);
  assert.equal(live.lane, 1);
  const sneaker = fighter('sneaker-reseller'),
    enemy = fighter('plug', 'opponent', 0, 5);
  const enemyResource = {
    ...resource,
    id: 'resource-enemy',
    side: 'opponent' as const,
    hands: 200,
  };
  const flip = harness([sneaker, enemy, enemyResource]);
  networkEntrance(flip, sneaker);
  assert.equal(enemy.weakened, true);
  assert.equal(enemyResource.weakened, undefined);
});

test('Network passes the real helper into gain before reactions, preserving a nested helper’s source and text', () => {
  const gamer = fighter('gamer'),
    ally = fighter('plug', 'player', 1),
    ctx = harness([gamer, ally]);
  const original = ctx.gain,
    sources: string[] = [];
  ctx.gain = (target, amount, _copied, source) => {
    assert.ok(source);
    sources.push(source.id);
    original(target, amount);
    ctx.event({
      type: 'buff',
      side: target.side,
      lane: target.lane,
      targetUnitId: target.id,
      sourceUnitId: 'nested-helper',
      sourceSide: target.side,
      amount: 2,
      text: 'NESTED REACTION +2',
    });
  };
  networkEntrance(ctx, gamer);
  assert.deepEqual(sources, [gamer.id]);
  const nested = ctx.state.events.find(
    (event) => event.sourceUnitId === 'nested-helper',
  )!;
  assert.equal(nested.text, 'NESTED REACTION +2');
  assert.equal(nested.amount, 2);
});
test('a departed Foreman’s stored job source and a held Gamer keep exact helper identities when they award Hands', () => {
  const foreman = fighter('circuit-captain'),
    worker = fighter('plug', 'player', 1),
    ctx = harness([foreman, worker]);
  networkEntrance(ctx, foreman);
  ctx.state.units = [worker];
  const original = ctx.gain,
    helpers: { id: string; cardId: string }[] = [];
  ctx.gain = (target, amount, _copied, source) => {
    assert.ok(source);
    helpers.push(source);
    original(target, amount);
  };
  networkMoved(ctx, worker);
  assert.deepEqual(helpers, [
    {
      id: foreman.id,
      cardId: foreman.cardId,
      side: foreman.side,
      lane: foreman.lane,
      position: foreman.position,
    },
  ]);
  const gamer = fighter('gamer');
  ctx.state.units.push(gamer);
  ctx.state.players.player.hand = ['gamer'];
  time(ctx, 10000);
  assert.equal(helpers.at(-1)!.id, 'hand:player:gamer');
  assert.equal(helpers.at(-1)!.cardId, 'gamer');
});

test('delayed support receipts retain and deep-clone the actual originating action helper before a ward payout', () => {
  const target = fighter('plug'),
    source = {
      id: 'action:actual-watch',
      cardId: 'bust-down-watch',
      side: 'player' as const,
      lane: 0 as Lane,
      position: 0,
    };
  const runtime = createSupportRuntime();
  runtime.watches.push({
    cardId: 'bust-down-watch',
    side: 'player',
    lane: 0,
    targetId: target.id,
    source,
  });
  const copy = cloneSupportRuntime(runtime);
  copy.watches[0].source!.id = 'branch-only';
  assert.equal(runtime.watches[0].source!.id, 'action:actual-watch');
  let observed: unknown;
  supportProtectionConsumed(runtime, target, {
    gain: (_target, amount, cause, helper) => {
      assert.equal(amount, 2);
      assert.equal(cause.cardId, 'bust-down-watch');
      observed = helper;
    },
  } as SupportTools);
  assert.deepEqual(observed, source);
  assert.equal(runtime.watches.length, 0);
});

test('real Game Developer and completed Foreman refunds notify held refund observers with exact source identity', () => {
  const reduced = fighter('plug', 'player', 1);
  reduced.maxHands = reduced.baseHands - 1;
  reduced.hands = reduced.maxHands;
  let repaired = coreState([reduced]);
  repaired.players.player.motion = 5;
  repaired.players.player.hand = ['battery-back', 'powerhouse'];
  const repair = deploy(repaired, 'player', 'battery-back', 0);
  assert.equal(repair.error, undefined);
  repaired = repair.state;
  assert.equal(repaired.reactions!.banked['player:powerhouse'], 1);
  const dev = repaired.units.find((u) => u.cardId === 'battery-back')!;
  assert.ok(
    repaired.events.some(
      (e) => e.type === 'motion' && e.amount === 1 && e.sourceUnitId === dev.id,
    ),
  );

  let job = coreState();
  job.players.player.hand = ['circuit-captain', 'powerhouse'];
  const posted = deploy(job, 'player', 'circuit-captain', 0);
  assert.equal(posted.error, undefined);
  job = posted.state;
  const foreman = job.units.find((u) => u.cardId === 'circuit-captain')!;
  job.units = job.units.filter((u) => u.id !== foreman.id);
  for (const id of ['wiretap', 'plug']) {
    job.players.player.motion = 5;
    job.players.player.hand = [id, 'powerhouse'];
    const filled = deploy(job, 'player', id, 1);
    assert.equal(filled.error, undefined);
    job = filled.state;
  }
  assert.equal(job.reactions!.banked['player:powerhouse'], 1);
  assert.ok(
    job.events.some(
      (e) =>
        e.type === 'motion' && e.amount === 1 && e.sourceUnitId === foreman.id,
    ),
  );
  assert.equal(job.network!.seats.player.jobs, undefined);
});

test('Burn Rate borrowing, debt settlement and natural refill never masquerade as refundable Motion', () => {
  let state = coreState();
  state.players.player.motion = 5;
  state.players.player.hand = ['techbro-rich', 'powerhouse'];
  const borrowed = deploy(state, 'player', 'techbro-rich', 0);
  assert.equal(borrowed.error, undefined);
  state = borrowed.state;
  assert.equal(state.reactions?.banked['player:powerhouse'] ?? 0, 0);
  state = advance(state, 12000);
  assert.equal(state.reactions?.banked['player:powerhouse'] ?? 0, 0);
  assert.equal(state.network!.seats.player.debt, 0);
});
