import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameState, Lane, Side, Unit } from './src/breakthrough';
import {
  MUSIC_ADAPTERS,
  MUSIC_ABILITY_DESCRIPTIONS,
  cloneMusicRuntime,
  createMusicRuntime,
  musicCaptureDeployment,
  musicEntrance,
  musicPlayed,
  musicEntranceResolved,
  musicMoved,
  musicDamaged,
  musicGained,
  musicCleansed,
  musicMovementRestricted,
  musicTick,
  musicDiscount,
  musicSpendDiscount,
  type MusicContext,
  type MusicDefinition,
  type MusicReturnOptions,
} from './src/breakthroughMusic';

function harness() {
  const definitions = new Map<string, MusicDefinition>();
  for (const [id, adapter] of Object.entries(MUSIC_ADAPTERS))
    definitions.set(id, {
      id,
      ability: adapter.ability,
      cost: 2,
      hands: 4,
      kind: 'character',
      traits: ['music'],
      triggers: ['tour-money', 'sixteen-bars', 'everybody-watching'].includes(
        adapter.ability,
      )
        ? ['ongoing']
        : ['entrance'],
    });
  const seat = () => ({
    motion: 4,
    hand: [] as string[],
    queue: [],
    reinforcements: [],
    breaches: 0,
    squabbleUsed: false,
    returns: [],
    nextDrawAt: 3000,
    returnedHands: {} as Record<string, number>,
  });
  const state = {
    elapsedMs: 0,
    units: [] as Unit[],
    roster: [...definitions.values()],
    players: { player: seat(), opponent: seat() },
    events: [],
    nextEventId: 1,
  } as unknown as GameState;
  const hits: { source: string; target: string; amount: number }[] = [];
  const echoes: string[] = [];
  const returned: { id: string; options: MusicReturnOptions }[] = [];
  const blocked = new Set<string>();
  let nextUnit = 1;
  const ctx: MusicContext = {
    state,
    definition(u) {
      return (
        definitions.get(u.cardId) ?? {
          id: u.cardId,
          cost: 2,
          hands: 4,
          kind: 'character',
          traits: [],
          triggers: ['entrance'],
        }
      );
    },
    active(u) {
      return u.hands > 0 && !u.frozen && !u.silenced && !u.weakened;
    },
    power(u) {
      return u.frozen ? 0 : Math.max(0, u.hands);
    },
    gain(u, n) {
      const old = u.hands;
      u.hands += n;
      u.maxHands = Math.max(u.maxHands, u.hands);
      musicGained(ctx, u, u.hands - old);
    },
    damage(source, target, amount) {
      if (target.immune) return 0;
      if (target.protected) {
        target.protected = false;
        return 0;
      }
      const actual = Math.min(Math.max(0, target.hands), amount);
      target.hands -= actual;
      target.damageTaken = (target.damageTaken ?? 0) + actual;
      hits.push({ source: source.id, target: target.id, amount: actual });
      musicDamaged(ctx, { source, victim: target, amount: actual });
      return actual;
    },
    weaken(_source, target) {
      if (target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      const changed = !target.weakened;
      target.weakened = true;
      return changed;
    },
    silence(_source, target) {
      if (target.immune) return false;
      if (target.protected) {
        target.protected = false;
        return false;
      }
      const changed = !target.silenced;
      target.silenced = true;
      return changed;
    },
    protect(_source, target) {
      const changed = !target.protected;
      target.protected = true;
      return changed;
    },
    trim(_source, target, n) {
      if (target.immune) return 0;
      if (target.protected) {
        target.protected = false;
        return 0;
      }
      const actual = Math.min(n, Math.max(0, target.hands - target.baseHands));
      target.hands -= actual;
      return actual;
    },
    removeBonus(target, n) {
      const actual = Math.min(n, Math.max(0, target.hands - target.baseHands));
      target.hands -= actual;
      return actual;
    },
    openForMove(u, lane) {
      return (
        !u.frozen &&
        !blocked.has(`${u.id}:${lane}`) &&
        !(u.movementLocks ?? []).some(
          (lock) => lock.expiresAt > state.elapsedMs,
        )
      );
    },
    move(u, lane) {
      if (u.lane === lane || !ctx.openForMove(u, lane)) return false;
      const origin = u.lane;
      u.lane = lane;
      musicMoved(ctx, u, origin);
      return true;
    },
    returnAllyToHand(_source, target, options) {
      const player = state.players[target.side];
      if (
        player.hand.length >= 4 ||
        target.frozen ||
        (target.movementLocks ?? []).some(
          (lock) => lock.expiresAt > state.elapsedMs,
        )
      )
        return false;
      state.units = state.units.filter((u) => u.id !== target.id);
      player.hand.push(target.cardId);
      player.returnedHands![target.cardId] =
        target.hands + options.carriedHands;
      returned.push({ id: target.id, options });
      return true;
    },
    refund(side, n) {
      const player = state.players[side],
        actual = Math.min(n, 9 - player.motion);
      player.motion += actual;
      return actual;
    },
    echo(_source, target) {
      echoes.push(target.id);
      return musicEntrance(ctx, target, { echoed: true }) === true;
    },
    event(event) {
      state.events.push({ ...event, id: state.nextEventId++ });
    },
  };
  function unit(
    cardId: string,
    lane: Lane = 0,
    hands = 4,
    side: Side = 'player',
  ) {
    const u: Unit = {
      id: `u${nextUnit++}`,
      cardId,
      side,
      lane,
      hands,
      baseHands: 4,
      maxHands: Math.max(4, hands),
      position: 0.2,
      squabbled: false,
      nextEffectAt: 5000,
    };
    state.units.push(u);
    return u;
  }
  function resolve(
    u: Unit,
    outcome: 'resolved' | 'cancelled' | 'queued' | 'none' = 'resolved',
  ) {
    const snapshot = musicCaptureDeployment(ctx),
      paidLane = u.lane;
    u.entranceSucceeded =
      outcome === 'resolved' && musicEntrance(ctx, u) === true;
    musicPlayed(ctx, u, { snapshot, paidLane, outcome });
    musicEntranceResolved(ctx, u);
  }
  return {
    ctx,
    state,
    unit,
    resolve,
    definitions,
    hits,
    echoes,
    returned,
    blocked,
  };
}

test('fifteen explicit Music adapters have individual real-time descriptions', () => {
  assert.equal(Object.keys(MUSIC_ADAPTERS).length, 15);
  assert.equal(
    new Set(Object.values(MUSIC_ADAPTERS).map((a) => a.ability)).size,
    15,
  );
  for (const adapter of Object.values(MUSIC_ADAPTERS))
    assert.ok(MUSIC_ABILITY_DESCRIPTIONS[adapter.ability].length > 30);
});

test('Tour Van selects the weakest legally movable Music passenger and pays only after arrival', () => {
  const h = harness(),
    van = h.unit('tour-van-driver'),
    frozen = h.unit('studio-couch-yn', 1, 1),
    passenger = h.unit('the-opening-act', 2, 3);
  frozen.frozen = true;
  assert.equal(musicEntrance(h.ctx, van), true);
  assert.equal(passenger.lane, 0);
  assert.equal(passenger.hands, 5);
  assert.equal(van.hands, 6);
  const copy = h.unit('tour-van-driver');
  assert.equal(musicEntrance(h.ctx, copy), false);
  assert.equal(frozen.lane, 1);
  h.state.elapsedMs = 10000;
  frozen.frozen = false;
  assert.equal(musicEntrance(h.ctx, copy), true);
});

test('Mixtape transfers the eligible weakest artist and a failed move cannot award Hands', () => {
  const h = harness(),
    mixtape = h.unit('mixtape-cousin'),
    locked = h.unit('studio-couch-yn', 0, 1),
    passenger = h.unit('the-opening-act', 0, 3);
  locked.movementLocks = [{ sourceId: 'other', expiresAt: 20000 }];
  assert.equal(musicEntrance(h.ctx, mixtape), true);
  assert.equal(passenger.lane, 1);
  assert.equal(passenger.hands, 5);
  assert.equal(mixtape.hands, 5);
  const second = h.unit('mixtape-cousin');
  assert.equal(musicEntrance(h.ctx, second), false);
  h.state.elapsedMs = 10000;
  h.blocked.add(`${mixtape.id}:1`);
  h.blocked.add(`${mixtape.id}:2`);
  h.blocked.add(`${second.id}:1`);
  h.blocked.add(`${second.id}:2`);
  assert.equal(musicEntrance(h.ctx, second), false);
  assert.equal(second.hands, 4);
});

test('Studio Couch uses effective Hands for weakest Music ally and excludes itself and non-Music', () => {
  const h = harness(),
    couch = h.unit('studio-couch-yn'),
    ordinary = h.unit('ordinary', 0, 1),
    artist = h.unit('the-opening-act', 0, 9);
  artist.frozen = true;
  assert.equal(musicEntrance(h.ctx, couch), true);
  assert.equal(artist.hands, 12);
  assert.equal(ordinary.hands, 1);
  assert.equal(couch.hands, 4);
});

test('Whole Set handles all three lanes and a shared once-per-side reveal cap', () => {
  const h = harness(),
    band = h.unit('one-man-band'),
    second = h.unit('studio-couch-yn', 1),
    third = h.unit('the-opening-act', 2);
  assert.equal(musicEntrance(h.ctx, band), true);
  assert.deepEqual([band.hands, second.hands, third.hands], [7, 7, 7]);
  const copy = h.unit('one-man-band');
  assert.equal(musicEntrance(h.ctx, copy), false);
  const enemyBand = h.unit('one-man-band', 0, 4, 'opponent'),
    enemyAlly = h.unit('studio-couch-yn', 0, 4, 'opponent');
  assert.equal(musicEntrance(h.ctx, enemyBand), true);
  assert.equal(enemyAlly.hands, 8);
});

test('Whole Set does not spend a failed solo entrance and held payouts require genuine successful entrances', () => {
  const h = harness(),
    band = h.unit('one-man-band');
  assert.equal(musicEntrance(h.ctx, band), false);
  const couch = h.unit('studio-couch-yn');
  assert.equal(musicEntrance(h.ctx, band), true);
  h.state.players.player.hand = ['one-man-band'];
  couch.entranceSucceeded = false;
  musicEntranceResolved(h.ctx, couch);
  assert.equal(couch.hands, 8);
  couch.entranceSucceeded = true;
  musicEntranceResolved(h.ctx, couch, { echoed: true });
  assert.equal(couch.hands, 8);
  musicEntranceResolved(h.ctx, couch);
  assert.equal(couch.hands, 10);
  musicEntranceResolved(h.ctx, couch);
  assert.equal(couch.hands, 10);
  h.state.elapsedMs = 10000;
  musicEntranceResolved(h.ctx, couch);
  assert.equal(couch.hands, 12);
  h.state.elapsedMs = 20000;
  musicEntranceResolved(h.ctx, couch);
  assert.equal(couch.hands, 12);
});

test('Soundcheck pays exactly one successful different performance and ignores canceled/echoed/expired events', () => {
  const h = harness(),
    opener = h.unit('the-opening-act');
  assert.equal(musicEntrance(h.ctx, opener), true);
  const performer = h.unit('studio-couch-yn', 1);
  performer.entranceSucceeded = false;
  musicEntranceResolved(h.ctx, performer);
  assert.equal(h.state.players.player.motion, 4);
  performer.entranceSucceeded = true;
  musicEntranceResolved(h.ctx, performer, { echoed: true });
  assert.equal(h.state.players.player.motion, 4);
  musicEntranceResolved(h.ctx, performer);
  assert.equal(h.state.players.player.motion, 5);
  assert.equal(musicEntrance(h.ctx, h.unit('the-opening-act')), false);
  musicEntranceResolved(h.ctx, performer);
  assert.equal(h.state.players.player.motion, 5);
  const e = harness(),
    opening = e.unit('the-opening-act');
  musicEntrance(e.ctx, opening);
  e.state.elapsedMs = 20000;
  const late = e.unit('studio-couch-yn', 1);
  late.entranceSucceeded = true;
  musicEntranceResolved(e.ctx, late);
  assert.equal(e.state.players.player.motion, 4);
});

test('Spinback returns actual current Hands plus two and preserves its shared lifetime cap', () => {
  const h = harness(),
    dj = h.unit('the-dj'),
    artist = h.unit('studio-couch-yn', 0, 7);
  assert.equal(musicEntrance(h.ctx, dj), true);
  assert.equal(h.state.players.player.returnedHands![artist.cardId], 9);
  assert.deepEqual(h.returned[0].options, {
    carriedHands: 2,
    discount: 1,
    expiresAt: 20000,
  });
  const quote = musicDiscount(
    h.ctx,
    'player',
    h.definitions.get(artist.cardId)!,
    2,
  );
  assert.equal(quote?.kind, 'return');
  assert.equal(quote?.minimum, 1);
  const newDj = h.unit('the-dj'),
    replayed = h.unit(artist.cardId);
  assert.equal(musicEntrance(h.ctx, newDj), false);
  assert.equal(replayed.hands, 4);
});

test('Spinback rejects a full hand or frozen-only target without spending its return', () => {
  const h = harness(),
    dj = h.unit('the-dj'),
    target = h.unit('studio-couch-yn');
  target.frozen = true;
  assert.equal(musicEntrance(h.ctx, dj), false);
  target.frozen = false;
  h.state.players.player.hand = ['a', 'b', 'c', 'd'];
  assert.equal(musicEntrance(h.ctx, dj), false);
  assert.equal(h.ctx.state.music?.seats.player.used.spinback, undefined);
  h.state.players.player.hand = [];
  assert.equal(musicEntrance(h.ctx, dj), true);
});

test('Hype Man requires a different paid lane and living active caller/source', () => {
  const h = harness(),
    hype = h.unit('the-hype-man'),
    caller = h.unit('studio-couch-yn', 0, 2);
  assert.equal(musicEntrance(h.ctx, hype), true);
  const same = h.unit('the-opening-act', 0);
  musicPlayed(h.ctx, same, { outcome: 'resolved', paidLane: 0 });
  assert.equal(caller.hands, 2);
  const reply = h.unit('the-opening-act', 2);
  musicPlayed(h.ctx, reply, { outcome: 'resolved', paidLane: 2 });
  assert.equal(caller.hands, 5);
  assert.equal(reply.hands, 7);
  assert.equal(caller.protected, true);
  musicPlayed(h.ctx, reply, { outcome: 'resolved', paidLane: 2 });
  assert.equal(reply.hands, 7);
  musicEntrance(h.ctx, hype);
  hype.silenced = true;
  const later = h.unit('the-opening-act', 1);
  musicPlayed(h.ctx, later, { outcome: 'resolved' });
  assert.equal(later.hands, 4);
});

test('insurance pays denial refund or post-entrance Protection and boost, never both', () => {
  for (const outcome of ['queued', 'cancelled', 'resolved', 'none'] as const) {
    const h = harness(),
      manager = h.unit('the-manager-nice');
    musicEntrance(h.ctx, manager);
    const artist = h.unit('studio-couch-yn');
    const snapshot = musicCaptureDeployment(h.ctx);
    musicPlayed(h.ctx, artist, { outcome, snapshot });
    const denied = outcome === 'queued' || outcome === 'cancelled';
    assert.equal(h.state.players.player.motion, denied ? 5 : 4, outcome);
    assert.equal(artist.hands, denied ? 4 : 5, outcome);
    assert.equal(!!artist.protected, !denied, outcome);
    musicPlayed(h.ctx, artist, { outcome });
    assert.equal(h.state.players.player.motion, denied ? 5 : 4);
  }
});

test('deployment snapshot protects an earlier insurance contract while a new manager arms the next one', () => {
  const h = harness(),
    manager = h.unit('the-manager-nice');
  musicEntrance(h.ctx, manager);
  const snapshot = musicCaptureDeployment(h.ctx),
    next = h.unit('the-manager-nice');
  musicEntrance(h.ctx, next);
  musicPlayed(h.ctx, next, { outcome: 'cancelled', snapshot });
  assert.equal(h.state.players.player.motion, 5);
  assert.equal(
    h.state.music?.marks.filter((m) => m.kind === 'rider').length,
    1,
  );
  assert.equal(
    h.state.music?.marks.find((m) => m.kind === 'rider')?.source.id,
    next.id,
  );
});

test('Rapper independent local/remote windows are shared across copies, and echoes/failures pay nothing', () => {
  const h = harness(),
    rapper = h.unit('the-rapper'),
    copy = h.unit('the-rapper'),
    enemy = h.unit('enemy', 0, 10, 'opponent');
  const local = h.unit('studio-couch-yn');
  local.entranceSucceeded = true;
  musicEntranceResolved(h.ctx, local, { echoed: true });
  assert.equal(enemy.hands, 10);
  musicEntranceResolved(h.ctx, local);
  assert.equal(enemy.hands, 7);
  musicEntranceResolved(h.ctx, local);
  assert.equal(enemy.hands, 7);
  const remote = h.unit('studio-couch-yn', 1);
  remote.entranceSucceeded = true;
  musicEntranceResolved(h.ctx, remote);
  assert.equal(remote.hands, 7);
  assert.equal(rapper.hands, 4);
  assert.equal(copy.hands, 4);
  h.state.elapsedMs = 10000;
  musicEntranceResolved(h.ctx, local);
  assert.equal(enemy.hands, 4);
});

test('Merch earns two shared local Music discounts only for distinct real entrance windows', () => {
  const h = harness(),
    merch = h.unit('merch-table-hustler'),
    artist = h.unit('studio-couch-yn');
  h.unit('merch-table-hustler');
  artist.entranceSucceeded = true;
  musicEntranceResolved(h.ctx, artist);
  musicEntranceResolved(h.ctx, artist);
  assert.equal(h.state.music?.discounts.length, 1);
  assert.equal(
    musicDiscount(h.ctx, 'player', h.definitions.get(artist.cardId)!, 0)
      ?.minimum,
    1,
  );
  assert.equal(
    musicDiscount(h.ctx, 'player', h.definitions.get(artist.cardId)!, 1),
    undefined,
  );
  assert.equal(
    musicDiscount(h.ctx, 'opponent', h.definitions.get(artist.cardId)!, 0),
    undefined,
  );
  h.state.elapsedMs = 10000;
  musicEntranceResolved(h.ctx, artist);
  assert.equal(h.state.music?.discounts.length, 2);
  h.state.elapsedMs = 20000;
  musicEntranceResolved(h.ctx, artist);
  assert.equal(h.state.music?.discounts.length, 2);
  assert.equal(musicEntrance(h.ctx, merch), false);
});

test('Janky booking is spent on blocked hits, and only real damage adds Weaken', () => {
  for (const shield of [false, true]) {
    const h = harness(),
      promoter = h.unit('the-janky-promoter');
    musicEntrance(h.ctx, promoter);
    const enemy = h.unit('enemy', 1, 4, 'opponent');
    enemy.protected = shield;
    musicPlayed(h.ctx, enemy, { outcome: 'resolved' });
    assert.equal(enemy.hands, shield ? 4 : 3);
    assert.equal(!!enemy.weakened, !shield);
    assert.equal(
      h.state.music?.marks.some((m) => m.kind === 'booking'),
      false,
    );
    musicPlayed(h.ctx, enemy, { outcome: 'resolved' });
    assert.equal(enemy.hands, shield ? 4 : 3);
  }
});

test('Janky booking also catches a genuine movement arrival but not a failed/same-lane move', () => {
  const h = harness(),
    promoter = h.unit('the-janky-promoter');
  musicEntrance(h.ctx, promoter);
  const enemy = h.unit('enemy', 2, 4, 'opponent');
  musicMoved(h.ctx, enemy, 2);
  assert.equal(enemy.hands, 4);
  assert.equal(h.ctx.move(enemy, 1), true);
  assert.equal(enemy.hands, 3);
  assert.equal(enemy.weakened, true);
});

test('Celebrity follows actual enemy damage, including a detached Burn source, once per shared window', () => {
  const h = harness(),
    celeb = h.unit('the-local-celebrity'),
    victim = h.unit('studio-couch-yn', 2);
  h.unit('the-local-celebrity', 1);
  musicDamaged(h.ctx, { source: { side: 'player' }, victim, amount: 2 });
  assert.equal(celeb.lane, 0);
  musicDamaged(h.ctx, { source: { side: 'opponent' }, victim, amount: 0 });
  assert.equal(celeb.lane, 0);
  musicDamaged(h.ctx, { source: { side: 'opponent' }, victim, amount: 1 });
  assert.equal(celeb.lane, 2);
  assert.equal(celeb.hands, 5);
  assert.equal(
    h.state.units.find(
      (u) => u.cardId === 'the-local-celebrity' && u.id !== celeb.id,
    )?.lane,
    1,
  );
});

test('a failed Celebrity move consumes the attempt but grants no Hands', () => {
  const h = harness(),
    celeb = h.unit('the-local-celebrity'),
    victim = h.unit('studio-couch-yn', 2);
  h.blocked.add(`${celeb.id}:2`);
  musicDamaged(h.ctx, { source: { side: 'opponent' }, victim, amount: 1 });
  assert.equal(celeb.hands, 4);
  h.blocked.clear();
  musicDamaged(h.ctx, { source: { side: 'opponent' }, victim, amount: 1 });
  assert.equal(celeb.lane, 0);
});

test('Diss Track trims removable bonus or damages base, and never arms a Receipt after a block', () => {
  for (const bonus of [0, 3])
    for (const shield of [false, true]) {
      const h = harness(),
        rapper = h.unit('the-battle-rapper'),
        enemy = h.unit('enemy', 0, 4 + bonus, 'opponent');
      enemy.protected = shield;
      const changed = musicEntrance(h.ctx, rapper);
      assert.equal(changed, !shield);
      assert.equal(enemy.hands, shield ? 4 + bonus : bonus ? 4 : 0);
      assert.equal(
        h.state.music?.marks.some((m) => m.kind === 'diss'),
        !shield && bonus > 0,
      );
      if (bonus && !shield) {
        h.ctx.gain(enemy, 2);
        assert.equal(enemy.hands, 6);
        assert.equal(enemy.silenced, true);
        assert.equal(
          h.state.music?.marks.some((m) => m.kind === 'diss'),
          false,
        );
      }
    }
});

test('Diss Receipt gain remains when Silence is blocked, and the Receipt cannot repeat', () => {
  const h = harness(),
    rapper = h.unit('the-battle-rapper'),
    enemy = h.unit('enemy', 0, 7, 'opponent');
  musicEntrance(h.ctx, rapper);
  enemy.protected = true;
  h.ctx.gain(enemy, 1);
  assert.equal(enemy.hands, 5);
  assert.equal(enemy.silenced, undefined);
  assert.equal(enemy.protected, false);
  h.ctx.gain(enemy, 1);
  assert.equal(enemy.silenced, undefined);
});

test('360 Deal locks only its contract and pays actual remaining bonus at expiry', () => {
  const h = harness(),
    manager = h.unit('the-manager-evil'),
    client = h.unit('studio-couch-yn', 0, 4);
  client.movementLocks = [{ sourceId: 'other-lock', expiresAt: 50000 }];
  assert.equal(musicEntrance(h.ctx, manager), true);
  assert.equal(client.hands, 7);
  assert.equal(musicMovementRestricted(h.ctx, client), true);
  h.state.elapsedMs = 20000;
  musicTick(h.ctx);
  assert.equal(client.hands, 5);
  assert.equal(manager.hands, 6);
  assert.equal(musicMovementRestricted(h.ctx, client), false);
  assert.deepEqual(client.movementLocks, [
    { sourceId: 'other-lock', expiresAt: 50000 },
  ]);
  musicTick(h.ctx);
  assert.equal(manager.hands, 6);
});

test('360 Deal cancellation never removes unrelated locks or refreshes a returned client’s signature', () => {
  const h = harness(),
    manager = h.unit('the-manager-evil'),
    client = h.unit('studio-couch-yn');
  musicEntrance(h.ctx, manager);
  client.movementLocks!.push({ sourceId: 'other-lock', expiresAt: 50000 });
  musicCleansed(h.ctx, client);
  assert.deepEqual(client.movementLocks, [
    { sourceId: 'other-lock', expiresAt: 50000 },
  ]);
  h.state.units = h.state.units.filter((u) => u.id !== client.id);
  const redeployed = h.unit(client.cardId);
  assert.notEqual(redeployed.id, client.id);
  assert.equal(musicEntrance(h.ctx, manager), false);
  h.state.elapsedMs = 20000;
  musicTick(h.ctx);
  assert.equal(manager.hands, 4);
});

test('a disabled/dead Evil Manager receives no royalty and damaged-away bonus cannot be recreated', () => {
  for (const gone of [false, true]) {
    const h = harness(),
      manager = h.unit('the-manager-evil'),
      client = h.unit('studio-couch-yn');
    musicEntrance(h.ctx, manager);
    if (gone) h.state.units = h.state.units.filter((u) => u.id !== manager.id);
    else manager.silenced = true;
    client.hands = 3;
    h.state.elapsedMs = 20000;
    musicTick(h.ctx);
    assert.equal(client.hands, 3);
    assert.equal(manager.hands, 4);
    assert.equal(client.damageTaken, undefined);
  }
});

test('Torch repeats a successful cheap active entrance but never passive, failed, pricey or self-recursive entries', () => {
  const h = harness(),
    legend = h.unit('the-og-rap-legend'),
    couch = h.unit('studio-couch-yn', 0, 2),
    ally = h.unit('the-opening-act', 0, 5);
  couch.entranceSucceeded = true;
  ally.entranceSucceeded = false;
  assert.equal(musicEntrance(h.ctx, legend), true);
  assert.deepEqual(h.echoes, [couch.id]);
  assert.equal(couch.protected, true);
  assert.equal(legend.hands, 7);
  assert.equal(ally.hands, 5);
  assert.equal(musicEntrance(h.ctx, h.unit('the-og-rap-legend')), false);
  const e = harness(),
    torch = e.unit('the-og-rap-legend'),
    passive = e.unit('the-rapper');
  passive.entranceSucceeded = true;
  assert.equal(musicEntrance(e.ctx, torch), false);
  assert.deepEqual(e.echoes, []);
  assert.equal(musicEntrance(e.ctx, torch, { echoed: true }), false);
});

test('Torch remote reinforcement works without an eligible apprentice and is independent per side', () => {
  const h = harness(),
    legend = h.unit('the-og-rap-legend'),
    remote = h.unit('studio-couch-yn', 1);
  assert.equal(musicEntrance(h.ctx, legend), true);
  assert.equal(remote.hands, 8);
  assert.deepEqual(h.echoes, []);
  const enemyLegend = h.unit('the-og-rap-legend', 0, 4, 'opponent'),
    enemyRemote = h.unit('studio-couch-yn', 2, 4, 'opponent');
  assert.equal(musicEntrance(h.ctx, enemyLegend), true);
  assert.equal(enemyRemote.hands, 8);
});

test('discount quotes are pure, side-restricted, expire exactly, and spend only the selected identity', () => {
  const h = harness(),
    definition = h.definitions.get('studio-couch-yn')!;
  const before = JSON.stringify(h.state);
  assert.equal(musicDiscount(h.ctx, 'player', definition, 0), undefined);
  assert.equal(JSON.stringify(h.state), before);
  musicMovementRestricted(h.ctx, h.unit('ordinary'));
  musicCaptureDeployment(h.ctx);
  musicTick(h.ctx);
  assert.equal(h.state.music, undefined);
  const dj = h.unit('the-dj');
  h.unit('studio-couch-yn');
  musicEntrance(h.ctx, dj);
  const quoted = musicDiscount(h.ctx, 'player', definition, 0)!;
  assert.ok(quoted);
  assert.equal(musicSpendDiscount(h.ctx, 'opponent', quoted.id), false);
  assert.equal(musicSpendDiscount(h.ctx, 'player', quoted.id + 10), false);
  assert.equal(musicSpendDiscount(h.ctx, 'player', quoted.id), true);
  assert.equal(musicSpendDiscount(h.ctx, 'player', quoted.id), false);
});

test('runtime cloning preserves independent shared ledgers, source snapshots and existing movement locks', () => {
  const h = harness(),
    manager = h.unit('the-manager-evil');
  h.unit('studio-couch-yn');
  musicEntrance(h.ctx, manager);
  const cloned = cloneMusicRuntime(h.state.music)!;
  cloned.seats.player.used.torch = 99;
  cloned.seats.player.signedClients.push('other');
  cloned.marks[0].source.hands = 0;
  assert.equal(h.state.music!.seats.player.used.torch, undefined);
  assert.equal(
    h.state.music!.seats.player.signedClients.includes('other'),
    false,
  );
  assert.equal(h.state.music!.marks[0].source.hands, 4);
  assert.equal(cloneMusicRuntime(undefined), undefined);
  assert.notEqual(
    createMusicRuntime().seats.player,
    createMusicRuntime().seats.opponent,
  );
});

test('same deterministic Music command sequence produces identical effects and receipts', () => {
  const run = () => {
    const h = harness();
    h.unit('the-rapper');
    h.unit('merch-table-hustler');
    const manager = h.unit('the-manager-nice');
    h.resolve(manager);
    const couch = h.unit('studio-couch-yn');
    h.resolve(couch);
    h.state.elapsedMs = 10000;
    const evil = h.unit('the-manager-evil');
    h.resolve(evil);
    h.state.elapsedMs = 30000;
    musicTick(h.ctx);
    return JSON.stringify(h.state);
  };
  assert.equal(run(), run());
});

test('a genuine entrance gain stays successful if a synchronous reaction removes its bonus', () => {
  const h = harness(),
    couch = h.unit('studio-couch-yn'),
    target = h.unit('the-opening-act');
  const original = h.ctx.gain;
  h.ctx.gain = (u, n) => {
    original(u, n);
    u.hands -= n;
  };
  assert.equal(musicEntrance(h.ctx, couch), true);
  assert.equal(target.hands, 4);
});
