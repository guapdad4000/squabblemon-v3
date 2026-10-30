import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGame,
  deploy,
  type FighterDefinition,
  type Side,
} from './src/breakthrough';
import {
  BreakthroughRoomError,
  BreakthroughRoomServiceForSimulation as BreakthroughRoomService,
  commandBreakthroughRoom,
  createBreakthroughRoomForSimulation as createBreakthroughRoom,
  projectBreakthroughRoom,
  replayBreakthroughRoomJournal,
  tickBreakthroughRoom,
  type BreakthroughRoomCheckpoint,
  type BreakthroughRoomStore,
  type RoomCommandEnvelope,
  type RoomCommit,
  type RoomJournalEntry,
  type RoomTerminalEvent,
} from './src/breakthroughRoom';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
  id: `card-${i}`,
  name: `Card ${i}`,
  cost: 1,
  hands: 3,
  art: '/fixture.webp',
  description: 'Fixture',
  ability: 'none',
}));
function room(
  options: {
    durationMs?: number;
    expiresAtMs?: number;
    roster?: FighterDefinition[];
  } = {},
): BreakthroughRoomCheckpoint {
  return createBreakthroughRoom({
    roomId: 'room-1',
    ownerFence: 1,
    members: { player: 'account-a', opponent: 'account-b' },
    serverTimeMs: 1000,
    expiresAtMs: options.expiresAtMs ?? 200000,
    game: createGame(options.roster ?? roster, {
      seed: 12345,
      durationMs: options.durationMs ?? 180000,
    }),
  });
}
function play(
  sequence: number,
  cardId: string,
  lane: 0 | 1 | 2 = 0,
  commandId = `command-${sequence}`,
): RoomCommandEnvelope {
  return {
    commandId,
    sequence,
    observedRevision: 0,
    command: { kind: 'deploy', cardId, lane },
  };
}
function protocol(code: string): (error: unknown) => boolean {
  return (error) =>
    error instanceof BreakthroughRoomError && error.code === code;
}
/** Test adapter only: this is not production persistence, a worker lease or a network test. */
class TestStore implements BreakthroughRoomStore {
  checkpoint: BreakthroughRoomCheckpoint;
  journal: RoomJournalEntry[] = [];
  terminals = new Map<string, RoomTerminalEvent>();
  beforeCommit: ((commit: RoomCommit) => void) | undefined;
  failAfterNextCommit = false;
  constructor(initial: BreakthroughRoomCheckpoint) {
    this.checkpoint = clone(initial);
  }
  async load(id: string) {
    return id === this.checkpoint.roomId ? clone(this.checkpoint) : null;
  }
  async commit(commit: RoomCommit) {
    this.beforeCommit?.(commit);
    if (
      this.checkpoint.revision !== commit.expectedRevision ||
      this.checkpoint.ownerFence !== commit.expectedOwnerFence
    )
      return false;
    assert.equal(commit.checkpoint.revision, this.checkpoint.revision + 1);
    assert.equal(commit.checkpoint.ownerFence, this.checkpoint.ownerFence);
    assert.equal(commit.journal.revision, commit.checkpoint.revision);
    assert.ok(
      !this.journal.some((entry) => entry.revision === commit.journal.revision),
    );
    if (commit.terminal) {
      assert.ok(!this.terminals.has(commit.terminal.id));
      assert.deepEqual(commit.checkpoint.terminal, commit.terminal);
      this.terminals.set(commit.terminal.id, clone(commit.terminal));
    }
    this.checkpoint = clone(commit.checkpoint);
    this.journal.push(clone(commit.journal));
    if (this.failAfterNextCommit) {
      this.failAfterNextCommit = false;
      throw new Error('Connection lost after commit');
    }
    return true;
  }
}
function service(store: TestStore, clock: { now: number }, ownerFence = 1) {
  return new BreakthroughRoomService({
    roomId: 'room-1',
    ownerFence,
    store,
    now: () => clock.now,
  });
}

test('creation rejects invalid membership, expiry, ownership and incompatible rulesets without mutating the game', () => {
  const initial = room(),
    snapshot = clone(initial.game);
  const base = {
    roomId: initial.roomId,
    ownerFence: 1,
    serverTimeMs: 1000,
    expiresAtMs: 2000,
    members: initial.members,
    game: initial.game,
  };
  for (const bad of [
    { members: { player: 'same', opponent: 'same' } },
    { ownerFence: 0 },
    { expiresAtMs: 1000 },
    { serverTimeMs: NaN },
  ])
    assert.throws(
      () => createBreakthroughRoom({ ...base, ...bad }),
      protocol('invalid-request'),
    );
  assert.throws(
    () =>
      createBreakthroughRoom({
        ...base,
        game: { ...base.game, ruleset: 'future-ruleset' },
      }),
    protocol('unsupported-checkpoint'),
  );
  assert.deepEqual(initial.game, snapshot);
});

test('simultaneous seats and rapid per-seat drops are ordered without stale-board rejection', async () => {
  const initial = room(),
    store = new TestStore(initial),
    clock = { now: 1000 },
    owner = service(store, clock);
  const commands = (side: Side) =>
    initial.game.players[side].hand.map((cardId, index) =>
      owner.command(
        initial.members[side],
        play(index + 1, cardId, (index % 3) as 0 | 1 | 2),
      ),
    );
  const acks = await Promise.all([
    ...commands('player'),
    ...commands('opponent'),
  ]);
  assert.ok(acks.every((ack) => ack.accepted));
  assert.deepEqual(
    acks.map((ack) => ack.revision),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(store.checkpoint.game.units.length, 8);
  assert.equal(store.checkpoint.game.players.player.motion, 0);
  assert.equal(store.checkpoint.game.players.opponent.motion, 0);
  assert.equal(store.checkpoint.seats.player.lastSequence, 4);
  assert.equal(store.checkpoint.seats.opponent.lastSequence, 4);
  assert.equal(initial.game.units.length, 0);
});

test('same identity retries return the original ack; command and sequence reuse cannot change intent', async () => {
  const initial = room(),
    store = new TestStore(initial),
    clock = { now: 1000 },
    owner = service(store, clock);
  const envelope = play(1, initial.game.players.player.hand[0]);
  const ack = await owner.command('account-a', envelope);
  clock.now = 5000;
  await owner.view('account-a');
  const retried = await owner.command('account-a', {
    ...envelope,
    observedRevision: 9999,
    command: { ...envelope.command, squabble: false },
  });
  assert.deepEqual(retried, ack);
  assert.equal(store.checkpoint.game.units.length, 1);
  assert.equal(store.journal.length, 2);
  await assert.rejects(
    owner.command('account-a', {
      ...envelope,
      command: { ...envelope.command, lane: 2 },
    }),
    protocol('command-id-conflict'),
  );
  await assert.rejects(
    owner.command('account-a', { ...envelope, sequence: 2 }),
    protocol('command-id-conflict'),
  );
  await assert.rejects(
    owner.command('account-a', { ...envelope, commandId: 'different-id' }),
    protocol('sequence-conflict'),
  );
  const reconnected = service(new TestStore(clone(store.checkpoint)), clock);
  assert.deepEqual(await reconnected.command('account-a', envelope), ack);
  ack.accepted = false;
  assert.equal(
    (await reconnected.command('account-a', envelope)).accepted,
    true,
  );
});

test('authorization, sequence gaps and malformed client state cannot consume a sequence or advance time', async () => {
  const store = new TestStore(room()),
    clock = { now: 9000 },
    owner = service(store, clock);
  const envelope = play(1, store.checkpoint.game.players.player.hand[0]);
  await assert.rejects(
    owner.command('intruder', envelope),
    protocol('unauthorized'),
  );
  await assert.rejects(owner.view('intruder'), protocol('unauthorized'));
  await assert.rejects(
    owner.command('account-a', { ...envelope, sequence: 2 }),
    (error) =>
      error instanceof BreakthroughRoomError &&
      error.code === 'sequence-gap' &&
      error.expectedSequence === 1,
  );
  for (const invalid of [
    { ...envelope, side: 'opponent' },
    { ...envelope, clientTimeMs: 0 },
    { ...envelope, sequence: 1.5 },
    { ...envelope, command: { ...envelope.command, lane: 3 } },
    { ...envelope, command: { ...envelope.command, hands: 99 } },
    {
      ...envelope,
      command: {
        ...envelope.command,
        target: { unitId: 'unit-1', position: 1 },
      },
    },
  ])
    await assert.rejects(
      owner.command('account-a', invalid),
      protocol('invalid-request'),
    );
  assert.equal(store.checkpoint.revision, 0);
  assert.equal(store.checkpoint.lastServerTimeMs, 1000);
  assert.equal(store.checkpoint.seats.player.lastSequence, 0);
});

test('cost failures use current authoritative Motion and stay rejected on retry after regeneration', async () => {
  const initial = room();
  initial.game.players.player.motion = 1;
  const store = new TestStore(initial),
    clock = { now: 1000 },
    owner = service(store, clock);
  const hand = initial.game.players.player.hand;
  assert.equal(
    (await owner.command('account-a', play(1, hand[0]))).accepted,
    true,
  );
  const denied = await owner.command('account-a', play(2, hand[1]));
  assert.equal(denied.code, 'invalid-play');
  assert.equal(store.checkpoint.game.players.player.motion, 0);
  assert.equal(store.checkpoint.game.units.length, 1);
  clock.now += 2000;
  await owner.tick();
  assert.deepEqual(await owner.command('account-a', play(2, hand[1])), denied);
  assert.equal(
    (await owner.command('account-a', play(3, hand[1]))).accepted,
    true,
  );
  assert.equal(store.checkpoint.game.units.length, 2);
});

test('support target locks are checked against current state; queued input is defensively captured', async () => {
  const cards = clone(roster);
  cards[9] = {
    ...cards[9],
    id: 'food',
    kind: 'support',
    hands: 0,
    ability: 'full-plate',
    action: { target: 'weakest-afflicted-ally', requiresFriendlyFighter: true },
  };
  const initial = room({ roster: cards });
  initial.game.players.player.hand = ['card-0', 'food'];
  const store = new TestStore(initial),
    clock = { now: 1000 },
    owner = service(store, clock);
  await owner.command('account-a', play(1, 'card-0'));
  const targetId = store.checkpoint.game.units[0].id,
    motion = store.checkpoint.game.players.player.motion;
  const invalid = await owner.command('account-a', {
    ...play(2, 'food'),
    command: {
      kind: 'deploy',
      cardId: 'food',
      lane: 0,
      target: { unitId: 'vanished' },
    },
  });
  assert.equal(invalid.accepted, false);
  assert.equal(store.checkpoint.game.players.player.motion, motion);
  const target = { unitId: targetId };
  const pending = owner.command('account-a', {
    ...play(3, 'food'),
    command: { kind: 'deploy', cardId: 'food', lane: 0, target },
  });
  target.unitId = 'mutated-after-send';
  assert.equal((await pending).accepted, true);
  assert.equal(store.checkpoint.game.units.length, 1);
  assert.equal(store.checkpoint.game.units[0].hands, 6);
  assert.deepEqual(store.checkpoint.game.players.player.returns, [
    { cardId: 'food', readyAt: 8000 },
  ]);
  assert.deepEqual(store.checkpoint.game.commands.at(-1)?.target, {
    unitId: targetId,
  });
});

test('authenticated views and ticks advance server time autonomously, retain fractional ticks and never run AI', async () => {
  const store = new TestStore(room()),
    clock = { now: 6000 },
    owner = service(store, clock);
  const view = await owner.view('account-a');
  assert.equal(view.elapsedMs, 5000);
  assert.equal(view.tick, 100);
  assert.equal(view.players.player.motion, 6.5);
  assert.equal(view.units.length, 0);
  const revision = store.checkpoint.revision;
  clock.now = 2000;
  await owner.tick();
  assert.equal(store.checkpoint.revision, revision);
  assert.equal(store.checkpoint.lastServerTimeMs, 6000);
  clock.now = 6001;
  await owner.tick();
  assert.equal(store.checkpoint.game.accumulatorMs, 1);
  clock.now = 6050;
  await owner.tick();
  assert.equal(store.checkpoint.game.tick, 101);
  assert.equal(store.checkpoint.game.commands.length, 0);
});

test('expiry advances only to its deadline, rejects late plays and inserts one durable terminal hook', async () => {
  const initial = room({ expiresAtMs: 1500 }),
    store = new TestStore(initial),
    clock = { now: 9000 },
    owner = service(store, clock);
  const envelope = play(1, initial.game.players.player.hand[0]);
  const ack = await owner.command('account-a', envelope);
  assert.equal(ack.code, 'room-expired');
  assert.equal(ack.elapsedMs, 500);
  assert.equal(ack.serverTimeMs, 1500);
  assert.equal(store.checkpoint.game.units.length, 0);
  assert.equal(store.terminals.size, 1);
  assert.equal(store.checkpoint.terminal?.result.reason, 'room-expired');
  assert.deepEqual(
    await service(store, clock).command('account-a', envelope),
    ack,
  );
  await owner.tick();
  await owner.view('account-b');
  assert.equal(
    (
      await owner.command(
        'account-b',
        play(1, initial.game.players.opponent.hand[0]),
      )
    ).code,
    'room-expired',
  );
  assert.equal(store.terminals.size, 1);
  assert.equal(store.journal.length, 2);
});

test('engine timeout is terminal once through repeated ticks, reconnects and late commands', async () => {
  const initial = room({ durationMs: 1000 }),
    store = new TestStore(initial),
    clock = { now: 2000 },
    owner = service(store, clock);
  await owner.tick();
  assert.equal(store.checkpoint.phase, 'complete');
  assert.equal(store.checkpoint.game.winner, 'draw');
  assert.equal(store.terminals.size, 1);
  assert.equal(store.checkpoint.terminal?.revision, 1);
  clock.now = 500000;
  await service(store, clock).tick();
  await owner.view('account-a');
  assert.equal(store.journal.length, 1);
  const late = await owner.command(
    'account-a',
    play(1, initial.game.players.player.hand[0]),
  );
  assert.equal(late.code, 'room-complete');
  assert.equal(store.terminals.size, 1);
  assert.equal(store.checkpoint.game.elapsedMs, 1000);
});

test('uncertain commit response is safely retried with original identity and no duplicated game/outbox effects', async () => {
  const initial = room(),
    store = new TestStore(initial),
    clock = { now: 1000 },
    owner = service(store, clock);
  const envelope = play(1, initial.game.players.player.hand[0]);
  store.failAfterNextCommit = true;
  await assert.rejects(
    owner.command('account-a', envelope),
    /Connection lost after commit/,
  );
  const persistedAck = clone(store.checkpoint.seats.player.receipts[0].ack);
  assert.deepEqual(await owner.command('account-a', envelope), persistedAck);
  assert.equal(store.checkpoint.game.units.length, 1);
  assert.equal(store.journal.length, 1);
  clock.now = 200000;
  store.failAfterNextCommit = true;
  await assert.rejects(owner.tick(), /Connection lost after commit/);
  assert.equal(store.terminals.size, 1);
  await service(store, clock).tick();
  assert.equal(store.terminals.size, 1);
  assert.equal(store.journal.length, 2);
});

test('CAS resolves concurrent owner requests and fences reject a superseded worker before mutation', async () => {
  const initial = room(),
    store = new TestStore(initial),
    clock = { now: 1000 };
  const first = service(store, clock),
    second = service(store, clock);
  const acks = await Promise.all([
    first.command('account-a', play(1, initial.game.players.player.hand[0])),
    second.command('account-b', play(1, initial.game.players.opponent.hand[0])),
  ]);
  assert.ok(acks.every((ack) => ack.accepted));
  assert.equal(store.checkpoint.game.units.length, 2);
  assert.deepEqual(
    store.journal.map((entry) => entry.revision),
    [1, 2],
  );
  store.beforeCommit = () => {
    store.checkpoint.ownerFence = 2;
    store.beforeCommit = undefined;
  };
  await assert.rejects(
    first.command('account-a', play(2, initial.game.players.player.hand[1])),
    protocol('stale-owner'),
  );
  assert.equal(store.checkpoint.game.units.length, 2);
  await assert.rejects(first.view('account-a'), protocol('stale-owner'));
  assert.equal(
    (
      await service(store, clock, 2).command(
        'account-a',
        play(2, initial.game.players.player.hand[1]),
      )
    ).accepted,
    true,
  );
});

test('durable journal replays exactly with accepted/rejected commands, clock progress and terminal event', async () => {
  const initial = room({ durationMs: 2000 }),
    store = new TestStore(initial),
    clock = { now: 1000 },
    owner = service(store, clock);
  await owner.command(
    'account-a',
    play(1, initial.game.players.player.hand[0]),
  );
  await owner.command('account-a', play(2, 'not-in-deck'));
  clock.now = 1501;
  await owner.tick();
  clock.now = 3000;
  await owner.tick();
  assert.deepEqual(
    replayBreakthroughRoomJournal(initial, clone(store.journal)),
    store.checkpoint,
  );
  assert.throws(
    () => replayBreakthroughRoomJournal(initial, store.journal.slice(1)),
    protocol('invalid-journal'),
  );
  const altered = clone(store.journal);
  if (altered[0].kind === 'command') altered[0].ack.accepted = false;
  assert.throws(
    () => replayBreakthroughRoomJournal(initial, altered),
    protocol('invalid-journal'),
  );
});

test('private views whitelist public data, hide all opponent draw state/RNG/catalog internals and filter Nerd events', () => {
  const initial = room();
  initial.game.players.opponent.hand = ['private-opponent-hand'];
  initial.game.players.opponent.queue = ['private-opponent-queue'];
  initial.game.players.opponent.returns = [
    { cardId: 'private-opponent-return', readyAt: 1000 },
  ];
  (initial.game as unknown as Record<string, unknown>).privateGameField =
    'private-game-field';
  (
    initial.game.roster[0] as unknown as Record<string, unknown>
  ).privateCatalogField = 'private-catalog-field';
  (
    initial.game.players.player as unknown as Record<string, unknown>
  ).privateSeatField = 'private-seat-field';
  initial.game.events = [
    {
      id: 1,
      type: 'reveal-hand',
      visibleTo: 'player',
      cardId: 'nerd-reveal-player',
      text: 'Player reveal',
    },
    {
      id: 2,
      type: 'reveal-hand',
      visibleTo: 'opponent',
      cardId: 'nerd-reveal-opponent',
      text: 'Opponent reveal',
    },
    { id: 3, type: 'public', text: 'Public' },
  ];
  (
    initial.game.events[2] as unknown as Record<string, unknown>
  ).privateEventField = 'private-event-field';
  const view = projectBreakthroughRoom(initial, 'account-a'),
    json = JSON.stringify(view);
  for (const secret of [
    'private-opponent-hand',
    'private-opponent-queue',
    'private-opponent-return',
    'private-game-field',
    'private-catalog-field',
    'private-seat-field',
    'private-event-field',
    'nerd-reveal-opponent',
  ])
    assert.ok(!json.includes(secret), secret);
  for (const key of [
    'seed',
    'effectsRng',
    'aiSeed',
    'aiStyle',
    'roster',
    'decks',
    'commands',
    'members',
    'receipts',
    'queue',
  ])
    assert.ok(!json.includes(`"${key}":`), key);
  assert.deepEqual(
    view.events.map((event) => event.id),
    [1, 3],
  );
  assert.deepEqual(
    projectBreakthroughRoom(initial, 'account-b').events.map(
      (event) => event.id,
    ),
    [2, 3],
  );
  assert.throws(
    () => projectBreakthroughRoom(initial, 'spectator'),
    protocol('unauthorized'),
  );
  view.hand.length = 0;
  view.events[0].text = 'changed';
  assert.equal(initial.game.players.player.hand.length, 4);
  assert.equal(initial.game.events[0].text, 'Player reveal');
});

test('pure transitions do not mutate the input checkpoint or caller envelope', () => {
  const initial = room(),
    snapshot = clone(initial),
    envelope = play(1, initial.game.players.player.hand[0]),
    input = clone(envelope);
  const accepted = commandBreakthroughRoom(
    initial,
    'account-a',
    envelope,
    1000,
  );
  tickBreakthroughRoom(accepted.checkpoint, 1100);
  assert.deepEqual(initial, snapshot);
  assert.deepEqual(envelope, input);
});

test('explicit card choices survive normalization, receipt identity and durable replay without a deployment wait', () => {
  const choiceRoster: FighterDefinition[] = roster.map((card, i) =>
    i
      ? card
      : {
          ...card,
          id: 'homeless-guy',
          ability: 'nothing-to-lose',
          choice: 'investment',
          cost: 1,
        },
  );
  const initial = room({ roster: choiceRoster });
  initial.game.players.player.hand = ['homeless-guy'];
  initial.game.players.player.motion = 9;
  const envelope: RoomCommandEnvelope = {
    commandId: 'chosen-investment',
    sequence: 1,
    command: {
      kind: 'deploy',
      cardId: 'homeless-guy',
      lane: 2,
      target: { choice: '3' },
    },
  };
  const mutation = commandBreakthroughRoom(
    initial,
    'account-a',
    envelope,
    1000,
  );
  assert.equal(mutation.ack.accepted, true);
  assert.equal(mutation.checkpoint.game.units.length, 1);
  assert.equal(mutation.checkpoint.game.units[0].lane, 2);
  assert.equal(mutation.checkpoint.game.players.player.motion, 5);
  assert.equal(mutation.checkpoint.game.units[0].hands, 7);
  assert.deepEqual(
    replayBreakthroughRoomJournal(initial, [mutation.journal!]),
    mutation.checkpoint,
  );
  assert.deepEqual(
    commandBreakthroughRoom(mutation.checkpoint, 'account-a', envelope, 1000)
      .ack,
    mutation.ack,
  );
  assert.throws(
    () =>
      commandBreakthroughRoom(
        mutation.checkpoint,
        'account-a',
        {
          ...envelope,
          command: { ...envelope.command, target: { choice: '2' } },
        },
        1000,
      ),
    protocol('command-id-conflict'),
  );
  for (const target of [
    { choice: 3 },
    { choice: '3', injected: true },
    { choice: '' },
  ])
    assert.throws(
      () =>
        commandBreakthroughRoom(
          initial,
          'account-a',
          {
            ...envelope,
            command: { ...envelope.command, target },
          },
          1000,
        ),
      protocol('invalid-request'),
    );
  const missing = commandBreakthroughRoom(
    initial,
    'account-a',
    {
      ...envelope,
      command: { ...envelope.command, target: undefined },
    },
    1000,
  );
  assert.equal(missing.ack.accepted, false);
  assert.deepEqual(missing.checkpoint.game, initial.game);
});

test('held-card procs reveal their public result without leaking hidden card identity', () => {
  const initial = room();
  initial.game.events = [
    {
      id: 1,
      type: 'gain',
      amount: 2,
      side: 'opponent',
      sourceSide: 'opponent',
      sourceUnitId: 'hand:opponent:secret-coach',
      cardId: 'secret-coach',
      targetUnitId: 'visible-fighter',
      text: 'SECRET COACH +2',
    },
  ];
  const other = projectBreakthroughRoom(initial, 'account-a').events[0];
  assert.equal(other.amount, 2);
  assert.equal(other.targetUnitId, 'visible-fighter');
  assert.equal(other.text, '+2');
  assert.equal(other.sourceUnitId, undefined);
  assert.equal(other.cardId, undefined);
  const own = projectBreakthroughRoom(initial, 'account-b').events[0];
  assert.equal(own.sourceUnitId, 'hand:opponent:secret-coach');
  assert.equal(own.text, 'SECRET COACH +2');
});

test('public projections include visible runtime forms and resource flags without private module ledgers', () => {
  const initial = room();
  const first = initial.game.players.player.hand[0];
  initial.game = deploy(initial.game, 'player', first, 0).state;
  const unit = initial.game.units[0];
  unit.art = '/public-powered-form.webp';
  unit.copiedAbility = 'network-boost';
  unit.formCost = 4;
  unit.immunityScope = 'abilities';
  unit.canFight = false;
  unit.canBreach = false;
  unit.countsHands = false;
  unit.movementLocks = [{ sourceId: 'jailer', expiresAt: 5000 }];
  const shown = projectBreakthroughRoom(initial, 'account-b').units[0];
  assert.equal(shown.art, unit.art);
  assert.equal(shown.ability, 'network-boost');
  assert.equal(shown.cost, 4);
  assert.equal(shown.immunityScope, 'abilities');
  assert.equal(shown.canFight, false);
  assert.equal(shown.canBreach, false);
  assert.equal(shown.countsHands, false);
  assert.equal(shown.movementLocked, true);
  assert.equal('movementLocks' in shown, false);
});
