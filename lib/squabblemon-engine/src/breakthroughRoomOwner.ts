import { chooseAi } from './breakthrough';
import { getBreakthroughLaunchReadiness } from './breakthroughCatalog';
import {
  BreakthroughRoomError,
  commandBreakthroughRoom,
  tickBreakthroughRoom,
  projectBreakthroughRoom,
  replayBreakthroughRoomJournal,
  type BreakthroughRoomCheckpoint,
  type RoomJournalEntry,
  type RoomTerminalEvent,
  type RoomAck,
  type BreakthroughRoomView,
} from './breakthroughRoom';
/** Durable adapter contract: one atomic transaction verifies revision + unexpired owner fence,
 * appends all unique (roomId,revision) entries, advances the durable head, optionally replaces
 * checkpoint, and inserts terminal.id in a unique outbox. No acknowledgment precedes this commit.
 * Recovery returns the checkpoint and contiguous journal suffix from one consistent read.
 * A new lease must first recover the old fence's suffix, then atomically checkpoint the new fence.
 */
export interface RoomJournalStore {
  recover(roomId: string): Promise<{
    checkpoint: BreakthroughRoomCheckpoint;
    journal: RoomJournalEntry[];
  } | null>;
  append(input: {
    roomId: string;
    expectedRevision: number;
    ownerFence: number;
    entries: RoomJournalEntry[];
    checkpoint: BreakthroughRoomCheckpoint | null;
    terminal: RoomTerminalEvent | null;
  }): Promise<boolean>;
}
export interface RoomOwnerOptions {
  roomId: string;
  ownerFence: number;
  store: RoomJournalStore;
  now(): number;
  /** Supplied by the trusted lease manager, never a client. Expired owners cannot read or mutate. */
  leaseExpiresAt(): number;
  checkpointEveryMs?: number;
  flushEveryMs?: number;
}
/** Single serialized authoritative room owner. Transport calls command, view and tick;
 * use encodeRoomStream on each authenticated connection. Host schedules tick every 50ms.
 * Tick journals batch up to 1s; every command (including a rejection) and terminal flushes.
 * A crash may lose only unacknowledged ticks, which are recomputed from trusted elapsed time.
 */
export class BreakthroughRoomOwnerForSimulation {
  private room: BreakthroughRoomCheckpoint | null = null;
  private pending: RoomJournalEntry[] = [];
  private nextRivalDecisionAt = 0;
  private durableRevision = 0;
  private lastCheckpointMs = 0;
  private lastFlushMs = 0;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly options: RoomOwnerOptions) {
    if (
      !options.roomId ||
      !Number.isSafeInteger(options.ownerFence) ||
      options.ownerFence < 1 ||
      !Number.isFinite(options.checkpointEveryMs ?? 10000) ||
      (options.checkpointEveryMs ?? 10000) < 50 ||
      !Number.isFinite(options.flushEveryMs ?? 1000) ||
      (options.flushEveryMs ?? 1000) < 50
    )
      throw new BreakthroughRoomError(
        'invalid-request',
        'Invalid room owner configuration',
      );
  }
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn);
    this.tail = next.catch(() => undefined);
    return next;
  }
  private async load(): Promise<BreakthroughRoomCheckpoint> {
    const now = this.options.now();
    if (
      !Number.isSafeInteger(now) ||
      now >= this.options.leaseExpiresAt() ||
      !Number.isFinite(this.options.leaseExpiresAt())
    )
      throw new BreakthroughRoomError('stale-owner', 'Room lease expired');
    if (!this.room) {
      const saved = await this.options.store.recover(this.options.roomId);
      if (!saved)
        throw new BreakthroughRoomError(
          'room-not-found',
          'Room does not exist',
        );
      const room = replayBreakthroughRoomJournal(
        saved.checkpoint,
        saved.journal,
      );
      if (
        room.roomId !== this.options.roomId ||
        room.ownerFence !== this.options.ownerFence
      )
        throw new BreakthroughRoomError(
          'stale-owner',
          'Room owner fence changed',
        );
      this.room = room;
      this.durableRevision = room.revision;
      this.lastCheckpointMs = saved.checkpoint.lastServerTimeMs;
      this.lastFlushMs = room.lastServerTimeMs;
    }
    return this.room;
  }
  private async flush(force = false): Promise<void> {
    if (!this.room || !this.pending.length) return;
    const room = this.room;
    if (
      !force &&
      !room.terminal &&
      room.lastServerTimeMs - this.lastFlushMs <
        (this.options.flushEveryMs ?? 1000)
    )
      return;
    const checkpoint =
      room.terminal ||
      room.lastServerTimeMs - this.lastCheckpointMs >=
        (this.options.checkpointEveryMs ?? 10000)
        ? structuredClone(room)
        : null;
    try {
      const ok = await this.options.store.append({
        roomId: room.roomId,
        expectedRevision: this.durableRevision,
        ownerFence: this.options.ownerFence,
        entries: structuredClone(this.pending),
        checkpoint,
        terminal: structuredClone(room.terminal),
      });
      if (!ok)
        throw new BreakthroughRoomError(
          'stale-owner',
          'Durable room head or lease changed',
        );
      this.durableRevision = room.revision;
      this.pending = [];
      this.lastFlushMs = room.lastServerTimeMs;
      if (checkpoint) this.lastCheckpointMs = room.lastServerTimeMs;
    } catch (error) {
      // Unknown commit outcomes must recover before retry; never acknowledge the speculative state.
      this.room = null;
      this.pending = [];
      throw error;
    }
  }
  command(principalId: string, envelope: unknown): Promise<RoomAck> {
    const frozen = structuredClone(envelope);
    return this.serialize(async () => {
      const room = await this.load(),
        result = commandBreakthroughRoom(
          room,
          principalId,
          frozen,
          this.options.now(),
        );
      this.room = result.checkpoint;
      if (result.journal) this.pending.push(result.journal);
      await this.flush(true);
      return structuredClone(result.ack);
    });
  }
  /** Reads never advance time or write. A host tick owns simulation advancement. */
  view(principalId: string): Promise<BreakthroughRoomView> {
    return this.serialize(async () =>
      projectBreakthroughRoom(await this.load(), principalId),
    );
  }
  tick(): Promise<void> {
    return this.serialize(async () => {
      const room = await this.load(),
        now = this.options.now();
      if (now < room.expiresAtMs && now - room.lastServerTimeMs < 50) return;
      const result = tickBreakthroughRoom(room, now);
      this.room = result.checkpoint;
      if (result.journal) this.pending.push(result.journal);
      // Use the existing serialized host tick, at most one legal rival intent per second.
      // Durable command sequence + journal make recovery/retries use the same authority as humans.
      const automated = this.room.automated;
      if (automated && this.room.phase === 'active' && now >= this.nextRivalDecisionAt) {
        this.nextRivalDecisionAt = now + 1000;
        const play = chooseAi(this.room.game, automated, this.room.game.aiStyle);
        if (play) {
          const sequence = this.room.seats[automated].lastSequence + 1;
          const command = commandBreakthroughRoom(this.room, this.room.members[automated], {
            commandId: `rival:${sequence}`, sequence, command: { kind: 'deploy', ...play },
          }, now);
          this.room = command.checkpoint;
          if (command.journal) this.pending.push(command.journal);
        }
      }
      await this.flush();
    });
  }
  close(): Promise<void> {
    return this.serialize(async () => {
      await this.load();
      await this.flush(true);
    });
  }
}

/** Public hosts must pass the same all-card review gate as room admission. */
export class BreakthroughRoomOwner extends BreakthroughRoomOwnerForSimulation {
  constructor(options: RoomOwnerOptions) {
    if (!getBreakthroughLaunchReadiness().canLaunch)
      throw new BreakthroughRoomError(
        'mode-unavailable',
        'Public Breakthrough PvP is not approved.',
      );
    super(options);
  }
}
