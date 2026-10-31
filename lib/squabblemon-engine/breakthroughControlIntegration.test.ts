import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  advance,
  createGame,
  deploy,
  deploymentCost,
  type GameState,
  type Lane,
  type Side,
  type Unit,
} from './src/breakthrough';
import {
  BREAKTHROUGH_ROSTER,
  BREAKTHROUGH_STARTER_DECKS,
  resolveBreakthroughCard,
} from './src/breakthroughCatalog';
let serial = 0;
function u(
  cardId: string,
  side: Side = 'player',
  lane: Lane = 0,
  hands?: number,
): Unit {
  const c = resolveBreakthroughCard(cardId)!;
  assert.ok(c, cardId);
  return {
    id: `ctrl-${++serial}`,
    cardId,
    side,
    lane,
    position: side === 'player' ? 0.12 : 0.88,
    hands: hands ?? c.hands,
    baseHands: c.hands,
    maxHands: hands ?? c.hands,
    squabbled: false,
    nextEffectAt: 1e9,
  };
}
function game(units: Unit[] = []): GameState {
  const deck = BREAKTHROUGH_STARTER_DECKS[0].catalogCardIds;
  const s = createGame(BREAKTHROUGH_ROSTER, {
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
  s.units = units;
  for (const side of ['player', 'opponent'] as const) {
    s.players[side].hand = [];
    s.players[side].queue = [];
    s.players[side].nextDrawAt = 1e9;
  }
  return s;
}
function play(
  s: GameState,
  id: string,
  lane: Lane = 0,
  side: Side = 'player',
): GameState {
  s.players[side].hand = [id];
  s.players[side].motion = 9;
  const result = deploy(s, side, id, lane);
  assert.equal(result.error, undefined, `${id}: ${result.error}`);
  return result.state;
}
const find = (s: GameState, x: Unit) => s.units.find((y) => y.id === x.id)!;
const card = (s: GameState, id: string) =>
  s.units.find((x) => x.cardId === id)!;

test('integrated Landlord+Audit previews and rejected inputs never spend money or mutate contracts', () => {
  const landlord = u('landlord', 'opponent');
  let s = play(game([landlord]), 'uncle-sam', 0, 'opponent');
  const before = structuredClone(s);
  const price = resolveBreakthroughCard('pinay-nurse')!.cost + 3;
  assert.equal(deploymentCost(s, 'player', 'pinay-nurse', 0), price);
  assert.deepEqual(s, before);
  s.players.player.hand = ['pinay-nurse'];
  s.players.player.motion = price - 1;
  const deniedBefore = structuredClone(s);
  const denied = deploy(s, 'player', 'pinay-nurse', 0);
  assert.ok(denied.error);
  assert.equal(denied.state, s);
  assert.deepEqual(s, deniedBefore);
  s.players.player.motion = price;
  const paid = deploy(s, 'player', 'pinay-nurse', 0);
  assert.equal(paid.error, undefined);
  assert.equal(paid.state.players.player.motion, 0);
  assert.equal(find(paid.state, landlord).hands, 4);
  assert.equal(paid.state.control!.audits.length, 0);
  assert.equal(paid.state.players.player.reinforcements.length, 0);
});
test('integrated Control discounts compete with other providers and do not spend unchosen tokens', () => {
  const plug = u('plug', 'player', 0);
  let s = play(game([plug]), 'bottle-girl');
  s.players.player.discount = { origin: 0 };
  const poison = BREAKTHROUGH_ROSTER.find(
    (c) =>
      c.element === 'Poison' &&
      c.kind === 'character' &&
      c.cost >= 2 &&
      !c.choice,
  )!;
  const quoted = deploymentCost(s, 'player', poison.id, 1);
  assert.equal(quoted, poison.cost - 1);
  s = play(s, poison.id, 1);
  assert.equal(
    s.control!.discounts.filter((x) => x.kind === 'poison').length,
    1,
  );
  assert.equal(s.players.player.discount, undefined);
});
test('DMV delays only reveal; back-to-back same-lane paid cards still materialize at the base', () => {
  let s = play(game(), 'dmv-worker', 0, 'opponent');
  s.players.player.hand = ['bottle-girl', 'pinay-nurse'];
  s.players.player.motion = 9;
  const a = deploy(s, 'player', 'bottle-girl', 0);
  assert.equal(a.error, undefined);
  assert.equal(card(a.state, 'bottle-girl').position, 0);
  assert.equal(a.state.control!.deferred.length, 1);
  assert.equal(a.state.control!.discounts.length, 0);
  const b = deploy(a.state, 'player', 'pinay-nurse', 0);
  assert.equal(b.error, undefined);
  assert.equal(card(b.state, 'pinay-nurse').position, 0);
  assert.equal(b.state.players.player.reinforcements.length, 0);
  assert.equal(b.state.elapsedMs, a.state.elapsedMs);
  s = advance(b.state, 10000);
  assert.equal(s.control!.deferred.length, 0);
  assert.equal(
    s.control!.discounts.filter((x) => x.kind === 'poison').length,
    1,
  );
  assert.equal(s.metrics.player.deployments, 2);
  assert.equal(s.commands.filter((x) => x.side === 'player').length, 2);
});
test('DMV deferred reveal preserves paid lane and cannot pay a second deployment/arrival trigger', () => {
  let s = game();
  s = play(s, 'stoner-sr', 0);
  s = play(s, 'dmv-worker', 0, 'opponent');
  s = play(s, 'bottle-girl', 0);
  const bottle = card(s, 'bottle-girl'),
    before = bottle.hands;
  assert.equal(before, 7);
  assert.equal(bottle.entrancePaidLane, 0);
  assert.equal(s.control!.stoners.length, 0);
  s = advance(s, 10000);
  assert.equal(card(s, 'bottle-girl').hands, before);
  assert.equal(s.metrics.player.deployments, 2);
  assert.equal(
    s.events.filter((e) => e.type === 'deploy' && e.cardId === 'bottle-girl')
      .length,
    1,
  );
});
test('Sherlock closes two lanes on one entrance cancellation, while passive-only cards do not spend it', () => {
  let s = play(game(), 'sherlock', 0, 'opponent');
  s = play(s, 'landlord', 1);
  assert.equal(s.control!.stakeouts.length, 1);
  s = play(s, 'dmv-worker', 2);
  assert.equal(card(s, 'dmv-worker').hands, 2);
  assert.equal(card(s, 'dmv-worker').entranceSucceeded, false);
  assert.equal(s.control!.tickets.length, 0);
  assert.equal(s.control!.stakeouts.length, 0);
  assert.equal(card(s, 'sherlock').hands, 4);
  assert.equal(s.players.player.reinforcements.length, 0);
});
test('queued musical entrance immediately consumes Rider as queued and refunds once', () => {
  let s = play(game(), 'the-manager-nice', 0); // contract marks are issued by the canonical manager
  const manager = card(s, 'the-manager-nice');
  assert.ok(manager);
  s = play(s, 'dmv-worker', 0, 'opponent');
  const music = BREAKTHROUGH_ROSTER.find(
    (c) =>
      c.traits?.includes('music') &&
      c.id !== 'the-manager-nice' &&
      c.triggers?.includes('entrance') &&
      c.cost <= 5 &&
      !c.choice,
  )!;
  s.players.player.hand = [music.id];
  s.players.player.motion = 7;
  const before = s.players.player.motion,
    cost = deploymentCost(s, 'player', music.id, 0);
  const d = deploy(s, 'player', music.id, 0);
  assert.equal(d.error, undefined);
  const refunds = d.state.events
    .filter((e) => e.type === 'motion' && e.sourceUnitId === manager.id)
    .reduce((n, e) => n + (e.amount ?? 0), 0);
  assert.equal(refunds, 1);
  assert.equal(d.state.players.player.motion, before - cost + 1);
  const n = advance(d.state, 10000);
  assert.equal(
    n.metrics.player.deployments,
    d.state.metrics.player.deployments,
  );
});
test('Lawyer atomically defers Feds Lock+Weaken, including no transient disabled/immobile frame', () => {
  const victim = u('hooper', 'player', 0);
  let s = play(game([victim]), 'lawyer');
  s = play(s, 'the-feds', 0, 'opponent');
  const v = find(s, victim);
  assert.equal(v.weakened, false);
  assert.equal(v.movementLocks?.length ?? 0, 0);
  assert.equal(s.control!.appeals[0].pending!.changes.length, 2);
  assert.equal(s.statuses.filter((x) => x.targetId === v.id).length, 0);
  find(s, victim).protected = true;
  s = advance(s, 10000);
  assert.equal(find(s, victim).weakened, true);
  assert.equal(find(s, victim).movementLocks?.length, 1);
  assert.equal(find(s, victim).protected, true);
  assert.equal(s.control!.appeals.length, 0);
});
test('moving an Appeal client dismisses all pending fields and issues discount at destination', () => {
  const victim = u('hooper', 'player', 0);
  let s = play(game([victim]), 'lawyer');
  s = play(s, 'the-feds', 0, 'opponent');
  s = play(s, 'bouncer', 0, 'opponent');
  const v = find(s, victim);
  assert.equal(v.lane, 1);
  assert.equal(v.weakened, false);
  assert.equal(v.movementLocks?.length ?? 0, 0);
  assert.equal(s.control!.appeals.length, 0);
  assert.equal(deploymentCost(s, 'player', 'plug', 1), 1);
  assert.equal(deploymentCost(s, 'player', 'plug', 0), 2);
  s = advance(s, 10000);
  assert.equal(find(s, victim).weakened, false);
});
test('a full cleanse dismisses pending invisible Appeal without waiting for a visible status', () => {
  const victim = u('hooper', 'player', 0);
  let s = play(game([victim]), 'lawyer');
  s = play(s, 'the-feds', 0, 'opponent');
  find(s, victim).hands = 1;
  find(s, victim).damageTaken = 6;
  s = play(s, 'hair-stylist');
  assert.equal(s.control!.appeals.length, 0);
  assert.equal(
    s.control!.discounts.filter((x) => x.kind === 'local-character').length,
    1,
  );
  s = advance(s, 10000);
  assert.equal(find(s, victim).weakened, false);
});
test('Lawyer captures legacy Cashier source-owned Lock and does not clear unrelated movement locks', () => {
  const victim = u('hooper', 'player', 0);
  let s = play(game([victim]), 'lawyer');
  s = play(s, 'squabblehouse-cashier', 0, 'opponent');
  assert.equal(find(s, victim).movementLocks?.length ?? 0, 0);
  const pending = s.control!.appeals[0].pending!;
  assert.equal(
    pending.changes.some((x) => x.kind === 'lock'),
    true,
  );
  s = advance(s, 10000);
  assert.equal(
    find(s, victim).movementLocks?.[0].sourceId.startsWith('house-cashier:'),
    true,
  );
});
test('Seafood consumes Burn without cleansing Freeze or Lock and one shield blocks whole detonation', () => {
  const a = u('hooper', 'opponent', 0, 12),
    b = u('plug', 'opponent', 0, 8),
    source = u('cornball', 'player', 1);
  let s = game([a, b, source]);
  s.statuses.push(
    {
      id: s.nextEffectId++,
      kind: 'burn',
      targetId: a.id,
      sourceUnitId: source.id,
      sourceSide: source.side,
      sourceLane: source.lane,
      sourcePosition: source.position,
      appliedAt: 0,
      nextTickAt: 2000,
      expiresAt: 6000,
      stacks: 2,
    },
    {
      id: s.nextEffectId++,
      kind: 'freeze',
      targetId: a.id,
      sourceUnitId: source.id,
      sourceSide: source.side,
      sourceLane: source.lane,
      sourcePosition: source.position,
      appliedAt: 0,
      nextTickAt: 2000,
      expiresAt: 10000,
      stacks: 1,
    },
  );
  a.burnStacks = 2;
  a.frozen = true;
  a.movementLocks = [{ sourceId: 'external', expiresAt: 20000 }];
  b.protected = true;
  s = play(s, 'seafood-assassin');
  assert.equal(find(s, a).hands, 8);
  assert.equal(find(s, a).frozen, true);
  assert.equal(find(s, a).movementLocks?.length, 1);
  assert.equal(
    s.statuses.some((x) => x.targetId === a.id && x.kind === 'burn'),
    false,
  );
  assert.equal(find(s, b).hands, 8);
  assert.equal(find(s, b).protected, false);
});
test('Hookah relay is scheduled for the next interval and cannot damage before startsAt', () => {
  const a = u('plug', 'opponent', 0, 20),
    b = u('snow-bunny', 'opponent', 1, 21);
  let s = play(game([a, b]), 'god-of-hookah', 2);
  s = advance(s, 10000);
  const delayed = s.statuses.find(
    (x) => x.targetId === b.id && x.kind === 'burn',
  )!;
  assert.ok(delayed);
  assert.equal(delayed.appliedAt, 20000);
  assert.equal(find(s, b).hands, 21);
  assert.equal(find(s, b).burnStacks, 0);
  s = advance(s, 10000);
  assert.equal(find(s, b).hands, 21);
  assert.equal(find(s, b).burnStacks, 1);
  s = advance(s, 2000);
  assert.equal(find(s, b).hands, 20);
});
test('personal Protection triggers Chair once, but SideEye ward cannot impersonate that shield', () => {
  const chair = u('juneteenth-chair-guy', 'player', 0),
    victim = u('hooper', 'player', 0, 9),
    sideEye = u('wifey', 'player', 0);
  let s = game([chair, victim, sideEye]);
  s = play(s, 'p-tang', 0, 'opponent');
  assert.equal(card(s, 'p-tang').hands, 4);
  assert.equal(s.control?.used[`chair:player:juneteenth-chair-guy`], undefined);
  s.units = s.units.filter((x) => x.id !== sideEye.id && x.cardId !== 'p-tang');
  find(s, victim).protected = true;
  s = play(s, 'p-tang', 0, 'opponent');
  assert.equal(card(s, 'p-tang').hands, 1);
  assert.equal(find(s, victim).protected, true);
  assert.equal(s.control!.used[`chair:player:juneteenth-chair-guy`], true);
});
test('Redneck actual burn-triggered splash does not repeat on subsequent Burn ticks', () => {
  const a = u('hooper', 'opponent', 0, 15),
    b = u('plug', 'opponent', 0, 10);
  let s = play(game([a, b]), 'redneck-evil');
  s = advance(s, 2000);
  assert.equal(find(s, b).hands, 8);
  assert.equal(s.control!.primers.length, 0);
  s = advance(s, 2000);
  assert.equal(find(s, b).hands, 8);
});
test('Mailman package cost+Hands is charged and granted once by real deploy', () => {
  const mail = u('the-mailman', 'player', 0);
  let s = game([mail]);
  const electric = ['nguyen', 'stockz', 'powerhouse'].map((id) =>
    resolveBreakthroughCard(id)!,
  );
  s = play(s, electric[0].id, 0);
  s = play(s, electric[1].id, 0);
  const waiting = s.control!.discounts.find(
    (x) => x.kind === 'electric-package',
  )!;
  assert.equal(waiting.lane, 1);
  const c = electric[2],
    beforeCost = deploymentCost(s, 'player', c.id, 1);
  s = play(s, c.id, 1);
  assert.equal(s.players.player.motion, 9 - beforeCost);
  assert.ok(card(s, c.id).hands >= c.hands + 2);
  assert.equal(
    s.control!.discounts.some((x) => x.kind === 'electric-package'),
    false,
  );
});
test('Feds movement-only Lock leaves other defenders mobile and rapid paid inputs possible', () => {
  const locked = u('hooper', 'player', 0, 9),
    other = u('plug', 'player', 0, 2);
  let s = play(game([locked, other]), 'the-feds', 0, 'opponent');
  assert.equal(!!find(s, locked).frozen, false);
  assert.equal(find(s, other).movementLocks, undefined);
  const before = find(s, other).position;
  s = advance(s, 1000);
  assert.ok(find(s, other).position > before);
  assert.equal(find(s, locked).position, 0.12);
  s = play(s, 'pinay-nurse');
  assert.equal(card(s, 'pinay-nurse').position, 0);
  assert.equal(s.players.player.reinforcements.length, 0);
});

function burnFrom(s: GameState, source: Unit, target: Unit) {
  s.statuses.push({
    id: s.nextEffectId++,
    kind: 'burn',
    targetId: target.id,
    sourceUnitId: source.id,
    sourceSide: source.side,
    sourceLane: source.lane,
    sourcePosition: source.position,
    appliedAt: s.elapsedMs,
    nextTickAt: s.elapsedMs + 2000,
    expiresAt: s.elapsedMs + 6000,
    stacks: 1,
  });
  target.burnStacks = 1;
}
test('Burn personal-shield consumption carries the living attacker into Chair retaliation', () => {
  const chair = u('juneteenth-chair-guy'),
    victim = u('hooper', 'player', 0, 9),
    source = u('cornball', 'opponent', 0, 8);
  let s = game([chair, victim, source]);
  victim.protected = true;
  burnFrom(s, source, victim);
  s = advance(s, 2000);
  assert.equal(find(s, source).hands, 5);
  assert.equal(find(s, victim).hands, 9);
  assert.equal(find(s, victim).protected, true);
  assert.equal(s.control!.used['chair:player:juneteenth-chair-guy'], true);
});
test('Burn from a removed source still consumes the ward and triggers Chair without phantom damage', () => {
  const chair = u('juneteenth-chair-guy'),
    victim = u('hooper', 'player', 0, 9),
    removed = u('cornball', 'opponent', 0, 8);
  let s = game([chair, victim]);
  victim.protected = true;
  burnFrom(s, removed, victim);
  s = advance(s, 2000);
  assert.equal(s.units.length, 2);
  assert.equal(
    s.units.some((x) => x.id === removed.id),
    false,
  );
  assert.equal(find(s, victim).hands, 9);
  assert.equal(find(s, victim).protected, true);
  assert.equal(s.control!.used['chair:player:juneteenth-chair-guy'], true);
  assert.equal(s.metrics.player.damage, 0);
});
test('removed-source Burn still cashes LeBron shield receipt without hitting a synthetic actor', () => {
  const victim = u('hooper', 'player', 0, 9),
    removed = u('cornball', 'opponent', 0, 8);
  let s = play(game([victim]), 'lebron-james');
  assert.equal(s.specials!.revenge.length, 1);
  burnFrom(s, removed, find(s, victim));
  s = advance(s, 2000);
  assert.equal(s.units.length, 2);
  assert.equal(find(s, victim).hands, 9);
  assert.equal(s.specials!.revenge.length, 0);
  assert.equal(s.metrics.player.damage, 0);
  assert.equal(find(s, victim).protected, false);
});
