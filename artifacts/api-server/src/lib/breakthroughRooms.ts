import type { pool } from "@workspace/db";
type Pool = typeof pool;
const connect = (p: Pool) => p.connect();
type PoolClient = Awaited<ReturnType<typeof connect>>;
import {
  replayBreakthroughRoomJournal,
  type BreakthroughRoomCheckpoint,
  type RoomJournalEntry,
} from "@workspace/squabblemon-engine/breakthroughRoom";
import type { RoomJournalStore } from "@workspace/squabblemon-engine/breakthroughRoomOwner";
/** Roster definitions are immutable for the room's lifetime. Send them once on creation;
 * PostgreSQL retains that exact catalog on subsequent checkpoint writes, including takeover.
 * Recovery still returns a self-contained checkpoint, independent of a newer deployed catalog.
 */
export function serializeRoomCheckpointUpdate(
  checkpoint: BreakthroughRoomCheckpoint,
): string {
  const { roster: _roster, ...game } = checkpoint.game;
  return JSON.stringify({ ...checkpoint, game });
}
/** Inject an explicitly selected pool. No import-time connection or live migration. */
export class PostgresBreakthroughRoomStore implements RoomJournalStore {
  constructor(private readonly pool: Pool) {}
  private async transaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await work(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async create(
    checkpoint: BreakthroughRoomCheckpoint,
    leaseMs = 15000,
  ): Promise<boolean> {
    this.validateLease(leaseMs);
    return this.transaction(async (c) => {
      const result = await c.query(
        `INSERT INTO breakthrough_rooms(room_id,owner_fence,lease_until,revision,checkpoint_revision,checkpoint,expires_at)
        VALUES($1,$2,clock_timestamp()+$3*interval '1 millisecond',$4,$4,$5,to_timestamp($6/1000.0)) ON CONFLICT DO NOTHING`,
        [
          checkpoint.roomId,
          checkpoint.ownerFence,
          leaseMs,
          checkpoint.revision,
          JSON.stringify(checkpoint),
          checkpoint.expiresAtMs,
        ],
      );
      return result.rowCount === 1;
    });
  }
  async recover(roomId: string) {
    return this.transaction(async (c) => {
      // Lock provides a single checkpoint/suffix view against append, compaction and lease takeover.
      const result = await c.query(
        "SELECT checkpoint FROM breakthrough_rooms WHERE room_id=$1 FOR SHARE",
        [roomId],
      );
      if (!result.rowCount) return null;
      const rows = await c.query(
        "SELECT entry FROM breakthrough_room_journal WHERE room_id=$1 ORDER BY revision",
        [roomId],
      );
      return {
        checkpoint: result.rows[0].checkpoint as BreakthroughRoomCheckpoint,
        journal: rows.rows.map((r) => r.entry as RoomJournalEntry),
      };
    });
  }
  async append(
    input: Parameters<RoomJournalStore["append"]>[0],
  ): Promise<boolean> {
    if (
      !input.entries.length ||
      input.entries.some(
        (e, i) =>
          e.roomId !== input.roomId ||
          e.ownerFence !== input.ownerFence ||
          e.revision !== input.expectedRevision + i + 1,
      )
    )
      throw Error("Non-contiguous room journal");
    const head = input.entries.at(-1)!.revision;
    if (
      input.checkpoint &&
      (input.checkpoint.roomId !== input.roomId ||
        input.checkpoint.ownerFence !== input.ownerFence ||
        input.checkpoint.revision !== head)
    )
      throw Error("Mismatched checkpoint");
    if (
      input.terminal &&
      (input.terminal.roomId !== input.roomId ||
        input.terminal.revision !== head)
    )
      throw Error("Mismatched terminal receipt");
    return this.transaction(async (c) => {
      const lock = await c.query(
        "SELECT revision,owner_fence,lease_until > clock_timestamp() AS valid FROM breakthrough_rooms WHERE room_id=$1 FOR UPDATE",
        [input.roomId],
      );
      const row = lock.rows[0];
      if (
        !row ||
        Number(row.revision) !== input.expectedRevision ||
        Number(row.owner_fence) !== input.ownerFence ||
        !row.valid
      )
        return false;
      await c.query(
        `INSERT INTO breakthrough_room_journal(room_id,revision,entry)
        SELECT $1,(value->>'revision')::bigint,value FROM jsonb_array_elements($2::jsonb)`,
        [input.roomId, JSON.stringify(input.entries)],
      );
      if (input.terminal)
        await c.query(
          "INSERT INTO breakthrough_room_outbox(id,room_id,event) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
          [input.terminal.id, input.roomId, JSON.stringify(input.terminal)],
        );
      if (input.checkpoint) {
        await c.query(
          "UPDATE breakthrough_rooms SET revision=$2,checkpoint_revision=$2,checkpoint=jsonb_set($3::jsonb,'{game,roster}',checkpoint#>'{game,roster}') WHERE room_id=$1",
          [input.roomId, head, serializeRoomCheckpointUpdate(input.checkpoint)],
        );
        await c.query(
          "DELETE FROM breakthrough_room_journal WHERE room_id=$1 AND revision<=$2",
          [input.roomId, head],
        );
      } else
        await c.query(
          "UPDATE breakthrough_rooms SET revision=$2 WHERE room_id=$1",
          [input.roomId, head],
        );
      return true;
    });
  }
  private validateLease(ms: number) {
    if (!Number.isSafeInteger(ms) || ms < 1000 || ms > 60000)
      throw Error("Lease must be 1000-60000ms");
  }
  async renew(
    roomId: string,
    fence: number,
    leaseMs = 15000,
  ): Promise<number | null> {
    this.validateLease(leaseMs);
    const result = await this.pool.query(
      `UPDATE breakthrough_rooms SET lease_until=clock_timestamp()+$3*interval '1 millisecond'
      WHERE room_id=$1 AND owner_fence=$2 AND lease_until>clock_timestamp() RETURNING extract(epoch FROM lease_until)*1000 AS until`,
      [roomId, fence, leaseMs],
    );
    return result.rowCount ? Math.floor(Number(result.rows[0].until)) : null;
  }
  /** Only an expired lease may be acquired. Replay old suffix before incrementing its fence. */
  async acquire(
    roomId: string,
    leaseMs = 15000,
  ): Promise<{
    checkpoint: BreakthroughRoomCheckpoint;
    leaseUntilMs: number;
  } | null> {
    this.validateLease(leaseMs);
    return this.transaction(async (c) => {
      const result = await c.query(
        "SELECT checkpoint,lease_until<=clock_timestamp() AS expired FROM breakthrough_rooms WHERE room_id=$1 FOR UPDATE",
        [roomId],
      );
      if (!result.rows[0]?.expired) return null;
      const journal = await c.query(
        "SELECT entry FROM breakthrough_room_journal WHERE room_id=$1 ORDER BY revision",
        [roomId],
      );
      const checkpoint = replayBreakthroughRoomJournal(
        result.rows[0].checkpoint,
        journal.rows.map((r) => r.entry),
      );
      checkpoint.ownerFence++;
      const updated = await c.query(
        `UPDATE breakthrough_rooms SET owner_fence=$2,checkpoint=jsonb_set($3::jsonb,'{game,roster}',checkpoint#>'{game,roster}'),checkpoint_revision=$4,
        lease_until=clock_timestamp()+$5*interval '1 millisecond' WHERE room_id=$1 RETURNING extract(epoch FROM lease_until)*1000 AS until`,
        [
          roomId,
          checkpoint.ownerFence,
          serializeRoomCheckpointUpdate(checkpoint),
          checkpoint.revision,
          leaseMs,
        ],
      );
      await c.query("DELETE FROM breakthrough_room_journal WHERE room_id=$1", [
        roomId,
      ]);
      return {
        checkpoint,
        leaseUntilMs: Math.floor(Number(updated.rows[0].until)),
      };
    });
  }
}
