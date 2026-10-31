import { getBreakthroughLaunchReadiness } from './breakthroughCatalog';
import {
  advance,
  unitDefinition,
  BREAKTHROUGH_RULESET,
  replayCommand,
  type BattleEvent,
  type DeployCommand,
  type GameState,
  type Lane,
  type MatchMetrics,
  type Side,
} from './breakthrough';

/** Private server domain. Checkpoints/journal entries must never be sent to clients. */
export const BREAKTHROUGH_ROOM_SCHEMA = 1 as const;
/** Retain all receipts for the room lifetime; never evict an ack then execute its retry. */
export const MAX_ROOM_COMMANDS_PER_SEAT = 2048;
export type RoomPhase = 'active' | 'complete' | 'expired';
export type RoomIntent =
  | {
      kind: 'deploy';
      cardId: string;
      lane: Lane;
      squabble?: boolean;
      target?: { unitId?: string; choice?: string };
    }
  | { kind: 'cancel-reinforcement'; cardId: string };
export interface RoomCommandEnvelope {
  commandId: string;
  sequence: number;
  command: RoomIntent;
  /** Diagnostic only. Valid concurrent plays never require an exact board revision. */
  observedRevision?: number;
}
export interface RoomAck {
  roomId: string;
  side: Side;
  commandId: string;
  sequence: number;
  nextSequence: number;
  revision: number;
  serverTimeMs: number;
  elapsedMs: number;
  accepted: boolean;
  code: 'accepted' | 'invalid-play' | 'room-complete' | 'room-expired';
  message?: string;
}
interface RoomReceipt {
  commandId: string;
  fingerprint: string;
  ack: RoomAck;
}
interface RoomSeat {
  lastSequence: number;
  receipts: RoomReceipt[];
}
/** Durable outbox item, unique by id. An external consumer must also deduplicate by id. */
export interface RoomTerminalEvent {
  id: string;
  roomId: string;
  revision: number;
  phase: 'complete' | 'expired';
  serverTimeMs: number;
  result: {
    winner: Side | 'draw' | null;
    reason: string | null;
    elapsedMs: number;
    metrics: Record<Side, MatchMetrics>;
  };
}
export interface BreakthroughRoomCheckpoint {
  schemaVersion: typeof BREAKTHROUGH_ROOM_SCHEMA;
  roomId: string;
  ownerFence: number;
  revision: number;
  members: Record<Side, string>;
  phase: RoomPhase;
  lastServerTimeMs: number;
  expiresAtMs: number;
  game: GameState;
  seats: Record<Side, RoomSeat>;
  terminal: RoomTerminalEvent | null;
}
type JournalHeader = {
  schemaVersion: typeof BREAKTHROUGH_ROOM_SCHEMA;
  roomId: string;
  ownerFence: number;
  revision: number;
  serverTimeMs: number;
};
export type RoomJournalEntry = JournalHeader &
  (
    | { kind: 'tick' }
    | {
        kind: 'command';
        side: Side;
        envelope: RoomCommandEnvelope;
        ack: RoomAck;
      }
  );
export interface RoomMutation {
  checkpoint: BreakthroughRoomCheckpoint;
  journal: RoomJournalEntry | null;
  /** Present only on the first transition to a terminal phase. */
  terminal: RoomTerminalEvent | null;
}
export type RoomErrorCode =
  | 'mode-unavailable'
  | 'invalid-request'
  | 'unauthorized'
  | 'room-not-found'
  | 'stale-owner'
  | 'sequence-gap'
  | 'sequence-conflict'
  | 'command-id-conflict'
  | 'command-limit'
  | 'commit-contention'
  | 'unsupported-checkpoint'
  | 'invalid-journal';
export class BreakthroughRoomError extends Error {
  constructor(
    public readonly code: RoomErrorCode,
    message: string,
    public readonly expectedSequence?: number,
  ) {
    super(message);
    this.name = 'BreakthroughRoomError';
  }
}
const sides: readonly Side[] = ['player', 'opponent'];
// Checkpoints deliberately use JSON data, matching a durable database/worker boundary.
function copy<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
function fail(
  code: RoomErrorCode,
  message: string,
  expectedSequence?: number,
): never {
  throw new BreakthroughRoomError(code, message, expectedSequence);
}
function integer(value: unknown, minimum = 0): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
  );
}
function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    !/[\u0000-\u001f]/.test(value)
  );
}
function object(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
function validateCheckpoint(room: BreakthroughRoomCheckpoint): void {
  if (
    room.schemaVersion !== BREAKTHROUGH_ROOM_SCHEMA ||
    room.game.ruleset !== BREAKTHROUGH_RULESET
  )
    fail(
      'unsupported-checkpoint',
      'Checkpoint requires an explicit schema/ruleset migration.',
    );
}
function seatFor(room: BreakthroughRoomCheckpoint, principalId: string): Side {
  const side = sides.find(
    (candidate) => room.members[candidate] === principalId,
  );
  if (!identifier(principalId) || !side)
    fail('unauthorized', 'Authenticated account is not a room member.');
  return side;
}
function normalizeEnvelope(input: unknown): RoomCommandEnvelope {
  if (
    !object(input, ['commandId', 'sequence', 'command', 'observedRevision']) ||
    !identifier(input.commandId) ||
    !integer(input.sequence, 1) ||
    (input.observedRevision !== undefined && !integer(input.observedRevision))
  )
    fail('invalid-request', 'Invalid room command envelope.');
  const intent = input.command;
  let command: RoomIntent;
  if (
    object(intent, ['kind', 'cardId']) &&
    intent.kind === 'cancel-reinforcement' &&
    identifier(intent.cardId)
  ) {
    command = { kind: 'cancel-reinforcement', cardId: intent.cardId };
  } else if (
    object(intent, ['kind', 'cardId', 'lane', 'squabble', 'target']) &&
    intent.kind === 'deploy' &&
    identifier(intent.cardId) &&
    (intent.lane === 0 || intent.lane === 1 || intent.lane === 2) &&
    (intent.squabble === undefined || typeof intent.squabble === 'boolean') &&
    (intent.target === undefined ||
      (object(intent.target, ['unitId', 'choice']) &&
        (intent.target.unitId === undefined ||
          identifier(intent.target.unitId)) &&
        (intent.target.choice === undefined ||
          identifier(intent.target.choice))))
  ) {
    command = {
      kind: 'deploy',
      cardId: intent.cardId,
      lane: intent.lane,
      squabble: intent.squabble === true,
      ...(intent.target &&
      (typeof intent.target.unitId === 'string' ||
        typeof intent.target.choice === 'string')
        ? {
            target: {
              ...(typeof intent.target.unitId === 'string'
                ? { unitId: intent.target.unitId }
                : {}),
              ...(typeof intent.target.choice === 'string'
                ? { choice: intent.target.choice }
                : {}),
            },
          }
        : {}),
    };
  } else fail('invalid-request', 'Invalid room command intent.');
  // observedRevision is intentionally absent from identity and persisted intent.
  return { commandId: input.commandId, sequence: input.sequence, command };
}
function fingerprint(command: RoomIntent): string {
  // Canonical exact comparison, not a client-supplied hash or collision-prone short checksum.
  return command.kind === 'deploy'
    ? JSON.stringify([
        command.kind,
        command.cardId,
        command.lane,
        !!command.squabble,
        command.target?.unitId ?? null,
        command.target?.choice ?? null,
      ])
    : JSON.stringify([command.kind, command.cardId]);
}
function serverTime(value: number): number {
  if (!integer(value))
    fail(
      'invalid-request',
      'Trusted server clock must return nonnegative safe integer milliseconds.',
    );
  return value;
}
function terminalEvent(room: BreakthroughRoomCheckpoint): RoomTerminalEvent {
  return {
    id: `${room.roomId}:terminal`,
    roomId: room.roomId,
    revision: room.revision,
    phase: room.phase as 'complete' | 'expired',
    serverTimeMs: room.lastServerTimeMs,
    result: {
      winner: room.game.winner,
      reason: room.phase === 'expired' ? 'room-expired' : room.game.reason,
      elapsedMs: room.game.elapsedMs,
      metrics: copy(room.game.metrics),
    },
  };
}
/** Caller is trusted server code: createGame + canonical deck/ownership checks happen before creation. */
export function createBreakthroughRoom(
  input: CreateBreakthroughRoomInput,
): BreakthroughRoomCheckpoint {
  if (!getBreakthroughLaunchReadiness().canLaunch)
    fail(
      'mode-unavailable',
      'Breakthrough is not available until the full catalog is playable and verified.',
    );
  return createBreakthroughRoomForSimulation(input);
}

export interface CreateBreakthroughRoomInput {
  roomId: string;
  members: Record<Side, string>;
  ownerFence: number;
  serverTimeMs: number;
  expiresAtMs: number;
  game: GameState;
}
/** Internal simulation constructor. Never use for public room admission. */
export function createBreakthroughRoomForSimulation(
  input: CreateBreakthroughRoomInput,
): BreakthroughRoomCheckpoint {
  if (
    !identifier(input.roomId) ||
    !integer(input.ownerFence, 1) ||
    !sides.every((side) => identifier(input.members[side])) ||
    input.members.player === input.members.opponent ||
    !integer(input.expiresAtMs) ||
    input.expiresAtMs <= serverTime(input.serverTimeMs)
  )
    fail(
      'invalid-request',
      'Invalid room identity, membership, ownership fence or expiry.',
    );
  const room: BreakthroughRoomCheckpoint = {
    schemaVersion: BREAKTHROUGH_ROOM_SCHEMA,
    roomId: input.roomId,
    ownerFence: input.ownerFence,
    revision: 0,
    members: copy(input.members),
    phase: input.game.status === 'complete' ? 'complete' : 'active',
    lastServerTimeMs: input.serverTimeMs,
    expiresAtMs: input.expiresAtMs,
    game: copy(input.game),
    seats: {
      player: { lastSequence: 0, receipts: [] },
      opponent: { lastSequence: 0, receipts: [] },
    },
    terminal: null,
  };
  validateCheckpoint(room);
  // A new match must start active: terminal outbox insertion belongs to an atomic commit.
  if (room.phase !== 'active')
    fail('invalid-request', 'Create rooms from a playing engine state.');
  return room;
}
function advanceClock(room: BreakthroughRoomCheckpoint, now: number): void {
  if (room.phase !== 'active') return;
  const next = Math.min(room.expiresAtMs, Math.max(room.lastServerTimeMs, now));
  room.game = advance(room.game, next - room.lastServerTimeMs);
  room.lastServerTimeMs = next;
  if (room.game.status === 'complete') room.phase = 'complete';
  else if (next >= room.expiresAtMs) room.phase = 'expired';
}
function finishMutation(
  previous: BreakthroughRoomCheckpoint,
  room: BreakthroughRoomCheckpoint,
  entry: Omit<
    JournalHeader,
    'schemaVersion' | 'roomId' | 'ownerFence' | 'revision' | 'serverTimeMs'
  > &
    (
      | { kind: 'tick' }
      | {
          kind: 'command';
          side: Side;
          envelope: RoomCommandEnvelope;
          ack: RoomAck;
        }
    ),
): RoomMutation {
  const terminal =
    !previous.terminal && room.phase !== 'active' ? terminalEvent(room) : null;
  if (terminal) room.terminal = terminal;
  const journal: RoomJournalEntry = {
    schemaVersion: BREAKTHROUGH_ROOM_SCHEMA,
    roomId: room.roomId,
    ownerFence: room.ownerFence,
    revision: room.revision,
    serverTimeMs: room.lastServerTimeMs,
    ...entry,
  };
  return { checkpoint: room, journal, terminal };
}
/** Trusted server time only. advance(), not practice AI, resolves every elapsed simulation tick. */
export function tickBreakthroughRoom(
  previous: BreakthroughRoomCheckpoint,
  serverTimeMs: number,
): RoomMutation {
  validateCheckpoint(previous);
  const now = serverTime(serverTimeMs);
  if (previous.phase !== 'active' || now <= previous.lastServerTimeMs)
    return { checkpoint: copy(previous), journal: null, terminal: null };
  const room = copy(previous);
  room.revision++;
  advanceClock(room, now);
  return finishMutation(previous, room, { kind: 'tick' });
}
/** Permanent play rejections consume a sequence; malformed/auth/gap/conflict requests do not. */
export function commandBreakthroughRoom(
  previous: BreakthroughRoomCheckpoint,
  principalId: string,
  input: unknown,
  serverTimeMs: number,
): RoomMutation & { ack: RoomAck } {
  validateCheckpoint(previous);
  const side = seatFor(previous, principalId),
    envelope = normalizeEnvelope(input),
    identity = fingerprint(envelope.command);
  const seat = previous.seats[side],
    existingId = seat.receipts.find(
      (receipt) => receipt.commandId === envelope.commandId,
    );
  if (existingId) {
    if (
      existingId.ack.sequence !== envelope.sequence ||
      existingId.fingerprint !== identity
    )
      fail(
        'command-id-conflict',
        'Command ID was already used for a different sequence or intent.',
      );
    return {
      checkpoint: copy(previous),
      journal: null,
      terminal: null,
      ack: copy(existingId.ack),
    };
  }
  if (envelope.sequence <= seat.lastSequence)
    fail(
      'sequence-conflict',
      'Sequence was already consumed.',
      seat.lastSequence + 1,
    );
  if (envelope.sequence !== seat.lastSequence + 1)
    fail('sequence-gap', 'Send the next seat sequence.', seat.lastSequence + 1);
  if (seat.receipts.length >= MAX_ROOM_COMMANDS_PER_SEAT)
    fail('command-limit', 'Room command limit reached.');
  const now = serverTime(serverTimeMs),
    room = copy(previous);
  room.revision++;
  advanceClock(room, now);
  let code: RoomAck['code'] =
    room.phase === 'complete'
      ? 'room-complete'
      : room.phase === 'expired'
        ? 'room-expired'
        : 'accepted';
  let message: string | undefined;
  if (room.phase === 'active') {
    const intent = envelope.command;
    const engineCommand: DeployCommand = {
      tick: room.game.tick,
      elapsedMs: room.game.elapsedMs,
      side,
      cardId: intent.cardId,
      lane: intent.kind === 'deploy' ? intent.lane : 0,
      squabble: intent.kind === 'deploy' && !!intent.squabble,
      ...(intent.kind === 'cancel-reinforcement'
        ? { action: intent.kind }
        : {}),
      ...(intent.kind === 'deploy' && intent.target
        ? { target: { ...intent.target } }
        : {}),
    };
    const result = replayCommand(room.game, engineCommand);
    if (result.error) {
      code = 'invalid-play';
      message = result.error;
    } else room.game = result.state;
    if (room.game.status === 'complete') room.phase = 'complete';
  }
  const ack: RoomAck = {
    roomId: room.roomId,
    side,
    commandId: envelope.commandId,
    sequence: envelope.sequence,
    nextSequence: envelope.sequence + 1,
    revision: room.revision,
    serverTimeMs: room.lastServerTimeMs,
    elapsedMs: room.game.elapsedMs,
    accepted: code === 'accepted',
    code,
    ...(message ? { message } : {}),
  };
  room.seats[side].lastSequence = envelope.sequence;
  room.seats[side].receipts.push({
    commandId: envelope.commandId,
    fingerprint: identity,
    ack: copy(ack),
  });
  return {
    ...finishMutation(previous, room, {
      kind: 'command',
      side,
      envelope,
      ack: copy(ack),
    }),
    ack,
  };
}

type PublicPlayer = {
  motion: number;
  breaches: number;
  squabbleUsed: boolean;
  handCount: number;
  queueCount: number;
  returnCount: number;
  nextDrawAt: number;
};
export interface BreakthroughRoomView {
  roomId: string;
  revision: number;
  phase: RoomPhase;
  side: Side;
  serverTimeMs: number;
  expiresAtMs: number;
  ruleset: string;
  tick: number;
  elapsedMs: number;
  durationMs: number;
  travelMs: number;
  winner: Side | 'draw' | null;
  reason: string | null;
  nextSequence: number;
  lastAck: RoomAck | null;
  players: Record<Side, PublicPlayer>;
  hand: string[];
  returns: { cardId: string; readyAt: number }[];
  transferTicket: boolean;
  discountOrigin: Lane | null;
  units: {
    id: string;
    cardId: string;
    side: Side;
    lane: Lane;
    position: number;
    hands: number;
    baseHands: number;
    maxHands: number;
    squabbled: boolean;
    frozen: boolean;
    silenced: boolean;
    weakened: boolean;
    burnStacks: number;
    protected: boolean;
    immune: boolean;
    damageTaken: number;
    art?: string;
    canFight: boolean;
    canBreach: boolean;
    countsHands: boolean;
    movementLocked: boolean;
    ability: string;
    cost: number;
    immunityScope: 'all' | 'abilities';
  }[];
  statuses: {
    id: number;
    kind: string;
    targetId: string;
    stacks: number;
    appliedAt: number;
    nextTickAt: number;
    expiresAt: number;
  }[];
  hazards: {
    id: number;
    kind: string;
    side: Side;
    lane: Lane;
    readyAt: number;
  }[];
  events: BattleEvent[];
}
/** Explicit public whitelist. Never spread GameState, roster definitions, players or events. */
export function projectBreakthroughRoom(
  room: BreakthroughRoomCheckpoint,
  principalId: string,
): BreakthroughRoomView {
  validateCheckpoint(room);
  const side = seatFor(room, principalId),
    game = room.game,
    own = game.players[side];
  const summary = (seat: Side): PublicPlayer => {
    const player = game.players[seat];
    return {
      motion: player.motion,
      breaches: player.breaches,
      squabbleUsed: player.squabbleUsed,
      handCount: player.hand.length,
      queueCount: player.queue.length,
      returnCount: player.returns.length,
      nextDrawAt: player.nextDrawAt,
    };
  };
  const events: BattleEvent[] = game.events
    .filter((event) => !event.visibleTo || event.visibleTo === side)
    .map((event) => {
      // A held aura's effects are public; its card identity remains private.
      const hiddenHeldSource =
        event.sourceUnitId?.startsWith('hand:') && event.sourceSide !== side;
      return {
        id: event.id,
        type: event.type,
        text: hiddenHeldSource
          ? event.type === 'gain'
            ? `+${event.amount ?? 0}`
            : event.type === 'protect'
              ? 'PROTECTED'
              : 'SUPPORT'
          : event.text,
        ...(event.side !== undefined ? { side: event.side } : {}),
        ...(event.lane !== undefined ? { lane: event.lane } : {}),
        ...(event.position !== undefined ? { position: event.position } : {}),
        ...(event.amount !== undefined ? { amount: event.amount } : {}),
        ...(event.damageKind !== undefined
          ? { damageKind: event.damageKind }
          : {}),
        ...(event.targetUnitId !== undefined
          ? { targetUnitId: event.targetUnitId }
          : {}),
        ...(event.cardId !== undefined && !hiddenHeldSource
          ? { cardId: event.cardId }
          : {}),
        ...(event.sourceUnitId !== undefined && !hiddenHeldSource
          ? { sourceUnitId: event.sourceUnitId }
          : {}),
        ...(event.sourceSide !== undefined
          ? { sourceSide: event.sourceSide }
          : {}),
        ...(event.sourceLane !== undefined
          ? { sourceLane: event.sourceLane }
          : {}),
        ...(event.sourcePosition !== undefined
          ? { sourcePosition: event.sourcePosition }
          : {}),
      };
    });
  return {
    roomId: room.roomId,
    revision: room.revision,
    phase: room.phase,
    side,
    serverTimeMs: room.lastServerTimeMs,
    expiresAtMs: room.expiresAtMs,
    ruleset: game.ruleset,
    tick: game.tick,
    elapsedMs: game.elapsedMs,
    durationMs: game.durationMs,
    travelMs: game.travelMs,
    winner: game.winner,
    reason: room.phase === 'expired' ? 'room-expired' : game.reason,
    nextSequence: room.seats[side].lastSequence + 1,
    lastAck: copy(room.seats[side].receipts.at(-1)?.ack ?? null),
    players: { player: summary('player'), opponent: summary('opponent') },
    hand: [...own.hand],
    returns: own.returns.map((item) => ({
      cardId: item.cardId,
      readyAt: item.readyAt,
    })),
    transferTicket: !!own.transferTicket,
    discountOrigin: own.discount?.origin ?? null,
    units: game.units.map((unit) => ({
      id: unit.id,
      cardId: unit.cardId,
      side: unit.side,
      lane: unit.lane,
      position: unit.position,
      hands: unit.hands,
      baseHands: unit.baseHands,
      maxHands: unit.maxHands,
      squabbled: unit.squabbled,
      frozen: !!unit.frozen,
      silenced: !!unit.silenced,
      weakened: !!unit.weakened,
      burnStacks: unit.burnStacks ?? 0,
      protected: !!unit.protected,
      immune: !!unit.immune,
      damageTaken: unit.damageTaken ?? 0,
      ability: unitDefinition(game, unit).ability ?? 'none',
      cost: unitDefinition(game, unit).cost,
      immunityScope: unit.immunityScope ?? 'all',
      ...(unit.art ? { art: unit.art } : {}),
      canFight: unit.canFight !== false,
      canBreach: unit.canBreach !== false,
      countsHands: unit.countsHands !== false,
      movementLocked: !!unit.movementLocks?.some(
        (lock) => lock.expiresAt > game.elapsedMs,
      ),
    })),
    statuses: game.statuses.map((status) => ({
      id: status.id,
      kind: status.kind,
      targetId: status.targetId,
      stacks: status.stacks,
      appliedAt: status.appliedAt,
      nextTickAt: status.nextTickAt,
      expiresAt: status.expiresAt,
    })),
    hazards: game.hazards.map((hazard) => ({
      id: hazard.id,
      kind: hazard.kind,
      side: hazard.side,
      lane: hazard.lane,
      readyAt: hazard.readyAt,
    })),
    events,
  };
}
/** Replay retained journal suffix against its matching checkpoint, using the same pinned ruleset. */
export function replayBreakthroughRoomJournal(
  checkpoint: BreakthroughRoomCheckpoint,
  entries: readonly RoomJournalEntry[],
): BreakthroughRoomCheckpoint {
  let room = copy(checkpoint);
  validateCheckpoint(room);
  for (const entry of entries) {
    if (
      entry.schemaVersion !== BREAKTHROUGH_ROOM_SCHEMA ||
      entry.roomId !== room.roomId ||
      entry.ownerFence !== room.ownerFence ||
      entry.revision !== room.revision + 1
    )
      fail(
        'invalid-journal',
        'Journal does not follow this checkpoint and ownership fence.',
      );
    const mutation =
      entry.kind === 'tick'
        ? tickBreakthroughRoom(room, entry.serverTimeMs)
        : commandBreakthroughRoom(
            room,
            room.members[entry.side],
            entry.envelope,
            entry.serverTimeMs,
          );
    if (JSON.stringify(mutation.journal) !== JSON.stringify(entry))
      fail(
        'invalid-journal',
        'Journal replay differs from the pinned reducer.',
      );
    room = mutation.checkpoint;
  }
  return room;
}

export interface RoomCommit {
  expectedRevision: number;
  expectedOwnerFence: number;
  checkpoint: BreakthroughRoomCheckpoint;
  journal: RoomJournalEntry;
  terminal: RoomTerminalEvent | null;
}
/**
 * Production adapter MUST atomically: compare room revision AND current owner fence/lease,
 * persist checkpoint, append unique (roomId,revision) journal entry, and insert terminal.id
 * into a durable outbox with a UNIQUE constraint. Return false on CAS loss. Throw on I/O failure.
 * Ownership acquisition/renewal must increment fences and reject expired leases, outside this module.
 * Never dispatch a reward/callback between these writes. A terminal consumer deduplicates by id.
 * Creation likewise atomically inserts the initial checkpoint under unique roomId after deck ownership checks.
 */
export interface BreakthroughRoomStore {
  load(roomId: string): Promise<BreakthroughRoomCheckpoint | null>;
  commit(commit: RoomCommit): Promise<boolean>;
}
/** One fenced owner instance per room. No public transport, matchmaking, lease or in-memory persistence implied. */
export interface BreakthroughRoomServiceOptions {
  roomId: string;
  ownerFence: number;
  store: BreakthroughRoomStore;
  now: () => number;
  maxCommitAttempts?: number;
}
/** Explicit internal simulator, never an authenticated public API service. */
export class BreakthroughRoomServiceForSimulation {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly options: BreakthroughRoomServiceOptions) {
    if (
      !identifier(options.roomId) ||
      !integer(options.ownerFence, 1) ||
      (options.maxCommitAttempts !== undefined &&
        (!integer(options.maxCommitAttempts, 1) ||
          options.maxCommitAttempts > 100))
    )
      fail('invalid-request', 'Invalid server room owner configuration.');
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.tail.then(operation);
    this.tail = pending.catch(() => undefined);
    return pending;
  }
  private async mutate<T>(
    reduce: (
      room: BreakthroughRoomCheckpoint,
      now: number,
    ) => RoomMutation & { value: T },
  ): Promise<T> {
    for (
      let attempt = 0;
      attempt < (this.options.maxCommitAttempts ?? 8);
      attempt++
    ) {
      const room = await this.options.store.load(this.options.roomId);
      if (!room) fail('room-not-found', 'Room does not exist.');
      validateCheckpoint(room);
      if (
        room.roomId !== this.options.roomId ||
        room.ownerFence !== this.options.ownerFence
      )
        fail('stale-owner', 'Room owner fence has changed.');
      const result = reduce(room, serverTime(this.options.now()));
      if (!result.journal) return copy(result.value);
      const committed = await this.options.store.commit({
        expectedRevision: room.revision,
        expectedOwnerFence: this.options.ownerFence,
        checkpoint: copy(result.checkpoint),
        journal: copy(result.journal),
        terminal: copy(result.terminal),
      });
      if (committed) return copy(result.value);
    }
    return fail(
      'commit-contention',
      'Room changed repeatedly; retry the same command identity.',
    );
  }
  async command(principalId: string, envelope: unknown): Promise<RoomAck> {
    // Snapshot the caller's input before asynchronous queueing; later UI mutation cannot change intent.
    const frozenEnvelope = normalizeEnvelope(envelope);
    return this.serialize(() =>
      this.mutate((room, now) => {
        const result = commandBreakthroughRoom(
          room,
          principalId,
          frozenEnvelope,
          now,
        );
        return { ...result, value: result.ack };
      }),
    );
  }
  view(principalId: string): Promise<BreakthroughRoomView> {
    return this.serialize(() =>
      this.mutate((room, now) => {
        seatFor(room, principalId); // Unauthorized reads cannot tick/persist a room.
        const result = tickBreakthroughRoom(room, now);
        return {
          ...result,
          value: projectBreakthroughRoom(result.checkpoint, principalId),
        };
      }),
    );
  }
  tick(): Promise<void> {
    return this.serialize(() =>
      this.mutate((room, now) => ({
        ...tickBreakthroughRoom(room, now),
        value: undefined,
      })),
    );
  }
}

/** Default service admission also protects reconnect/view/command paths. */
export class BreakthroughRoomService extends BreakthroughRoomServiceForSimulation {
  constructor(options: BreakthroughRoomServiceOptions) {
    if (!getBreakthroughLaunchReadiness().canLaunch)
      fail(
        'mode-unavailable',
        'Breakthrough is not available until the full catalog is playable and verified.',
      );
    super(options);
  }
}
