import { randomUUID, randomInt } from "node:crypto";
import type { pool as applicationPool } from "@workspace/db";
import {
  createGame,
  type FighterDefinition,
} from "@workspace/squabblemon-engine/breakthrough";
import {
  buildBreakthroughRoster,
  getBreakthroughLaunchReadiness,
} from "@workspace/squabblemon-engine/breakthroughCatalog";
import {
  createBreakthroughRoom,
  commandBreakthroughRoom,
  projectBreakthroughRoom,
  BreakthroughRoomError,
  type CreateBreakthroughRoomInput,
  type BreakthroughRoomCheckpoint,
} from "@workspace/squabblemon-engine/breakthroughRoom";
import {
  BreakthroughRoomOwner,
  type RoomOwnerOptions,
  type BreakthroughRoomOwnerForSimulation,
} from "@workspace/squabblemon-engine/breakthroughRoomOwner";
import {
  BREAKTHROUGH_REWARD_POLICY,
  BREAKTHROUGH_SEASON,
  type BreakthroughReceipt,
  type BreakthroughLobby,
} from "@workspace/squabblemon-engine/breakthroughOnline";
import { PostgresBreakthroughRoomStore } from "./breakthroughRooms";
type Pool = typeof applicationPool;
const connect = (pool: Pool) => pool.connect();
export type BreakthroughClient = Awaited<ReturnType<typeof connect>>;
export interface BreakthroughMember {
  userId: string;
  name: string;
  avatarKey: string;
  cards: string[];
}
/** Eligibility is the existing owned-deck/onboarding validator, using this transaction's connection. */
export interface BreakthroughRuntimeOptions {
  pool: Pool;
  member(
    client: BreakthroughClient,
    userId: string,
    deckId: string,
  ): Promise<BreakthroughMember>;
  report(error: unknown): void;
}
interface EngineBoundary {
  admit(): void;
  create(input: CreateBreakthroughRoomInput): BreakthroughRoomCheckpoint;
  owner(options: RoomOwnerOptions): BreakthroughRoomOwnerForSimulation;
  roster(): FighterDefinition[];
}
const productionEngine: EngineBoundary = {
  admit() {
    if (!getBreakthroughLaunchReadiness().canLaunch)
      throw new BreakthroughRoomError(
        "mode-unavailable",
        "Breakthrough public play is awaiting release verification.",
      );
  },
  create: createBreakthroughRoom,
  owner: (options) => new BreakthroughRoomOwner(options),
  roster: () => buildBreakthroughRoster(),
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = (message: string): never => {
  throw new BreakthroughRoomError("invalid-request", message);
};
type Hosted = {
  owner: BreakthroughRoomOwnerForSimulation;
  fence: number;
  until: number;
  members: string[];
};
/** Persistent process only. Netlify functions never instantiate an owner or start a timer. */
export class BreakthroughOnlineService {
  private readonly store: PostgresBreakthroughRoomStore;
  private readonly rooms = new Map<string, Hosted>();
  private readonly acquiring = new Map<string, Promise<Hosted>>();
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopping = false;
  private scanAt = 0;
  private readonly listeners = new Map<string, Set<() => void>>();
  constructor(
    private readonly options: BreakthroughRuntimeOptions,
    private readonly engine: EngineBoundary = productionEngine,
  ) {
    this.store = new PostgresBreakthroughRoomStore(options.pool);
  }
  private async transaction<T>(
    work: (c: BreakthroughClient) => Promise<T>,
  ): Promise<T> {
    const c = await this.options.pool.connect();
    try {
      await c.query("BEGIN");
      const value = await work(c);
      await c.query("COMMIT");
      return value;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  private search(row: any): BreakthroughLobby["search"] {
    return row
      ? {
          requestId: row.request_id,
          deckId: row.deck_id,
          status: row.status,
          roomId: row.room_id,
        }
      : null;
  }
  async lobby(userId: string): Promise<BreakthroughLobby> {
    this.engine.admit();
    // Heartbeat only queued searches, at most once per ten seconds. Paired/idle reads do not write.
    const result = await this.options.pool.query(
      `WITH heartbeat AS (
        UPDATE breakthrough_searches SET heartbeat_at=clock_timestamp()
        WHERE user_id=$1 AND status='waiting'
        AND heartbeat_at>clock_timestamp()-interval '30 seconds'
        AND heartbeat_at<=clock_timestamp()-interval '10 seconds'
      ) SELECT request_id,deck_id,status,room_id FROM breakthrough_searches
        WHERE user_id=$1 AND (status='paired' OR
        (status='waiting' AND heartbeat_at>clock_timestamp()-interval '30 seconds'))`,
      [userId],
    );
    const record = await this.options.pool.query(
      "SELECT trophies,wins,losses,draws FROM breakthrough_records WHERE user_id=$1 AND season=$2",
      [userId, BREAKTHROUGH_SEASON],
    );
    const recent = result.rowCount
      ? result
      : await this.options.pool.query(
          "SELECT request_id,deck_id,status,room_id FROM breakthrough_searches WHERE user_id=$1 AND status='complete' ORDER BY created_at DESC LIMIT 1",
          [userId],
        );
    return {
      search: this.search(recent.rows[0]),
      record: record.rows[0] ?? { trophies: 0, wins: 0, losses: 0, draws: 0 },
    };
  }
  async searchMatch(
    userId: string,
    deckId: string,
    requestId: string,
  ): Promise<BreakthroughLobby["search"]> {
    this.engine.admit();
    if (!uuid.test(requestId) || !deckId || deckId.length > 100)
      invalid("Choose a saved deck and a valid request ID.");
    const result = await this.transaction(async (c) => {
      // Shared existing PvP validator locks this account before admission. No client card list is trusted.
      const member = await this.options.member(c, userId, deckId);
      await c.query(
        "SELECT pg_advisory_xact_lock(hashtext('breakthrough-matchmaking-v1'))",
      );
      await c.query(
        "UPDATE breakthrough_searches SET status='cancelled' WHERE status='waiting' AND heartbeat_at<=clock_timestamp()-interval '30 seconds'",
      );
      const retry = await c.query(
        "SELECT * FROM breakthrough_searches WHERE user_id=$1 AND request_id=$2",
        [userId, requestId],
      );
      if (retry.rowCount) {
        if (retry.rows[0].deck_id !== deckId)
          invalid("This search ID was already used for another deck.");
        return retry.rows[0];
      }
      const active = await c.query(
        "SELECT * FROM breakthrough_searches WHERE user_id=$1 AND status IN ('waiting','paired')",
        [userId],
      );
      if (active.rowCount) return active.rows[0];
      const count = await c.query(
        "SELECT count(*)::int AS n FROM breakthrough_rooms WHERE checkpoint->>'phase'='active'",
      );
      if (count.rows[0].n >= 100)
        throw new BreakthroughRoomError(
          "mode-unavailable",
          "Live arenas are full. Please retry shortly.",
        );
      const rival = await c.query(
        "SELECT * FROM breakthrough_searches WHERE status='waiting' AND user_id<>$1 ORDER BY created_at LIMIT 1 FOR UPDATE",
        [userId],
      );
      const inserted = await c.query(
        `INSERT INTO breakthrough_searches(user_id,request_id,deck_id,member,status)
        VALUES($1,$2,$3,$4,'waiting') RETURNING *`,
        [userId, requestId, deckId, JSON.stringify(member)],
      );
      if (!rival.rowCount) return inserted.rows[0];
      const other = rival.rows[0].member as BreakthroughMember,
        now = Date.now(),
        roomId = randomUUID();
      const checkpoint = this.engine.create({
        roomId,
        ownerFence: 1,
        members: { player: other.userId, opponent: userId },
        serverTimeMs: now,
        expiresAtMs: now + 10 * 60 * 1000,
        game: createGame(this.engine.roster(), {
          seed: randomInt(1, 0x7fffffff),
          decks: { player: other.cards, opponent: member.cards },
        }),
      });
      // Creation, both seats and queue outcome commit together. An expired lease lets the host claim ownership.
      await c.query(
        `INSERT INTO breakthrough_rooms(room_id,owner_fence,lease_until,revision,checkpoint_revision,checkpoint,expires_at)
        VALUES($1,1,clock_timestamp(),0,0,$2,to_timestamp($3/1000.0))`,
        [roomId, JSON.stringify(checkpoint), checkpoint.expiresAtMs],
      );
      await c.query(
        "UPDATE breakthrough_searches SET status='paired',room_id=$1 WHERE status='waiting' AND user_id=ANY($2::text[])",
        [roomId, [userId, other.userId]],
      );
      return { ...inserted.rows[0], status: "paired", room_id: roomId };
    });
    return this.search(result);
  }
  async cancel(
    userId: string,
    requestId: string,
  ): Promise<BreakthroughLobby["search"]> {
    this.engine.admit();
    if (!uuid.test(requestId)) invalid("Invalid search ID.");
    return this.transaction(async (c) => {
      await c.query(
        "SELECT pg_advisory_xact_lock(hashtext('breakthrough-matchmaking-v1'))",
      );
      await c.query(
        "UPDATE breakthrough_searches SET status='cancelled' WHERE user_id=$1 AND request_id=$2 AND status='waiting'",
        [userId, requestId],
      );
      const row = await c.query(
        "SELECT * FROM breakthrough_searches WHERE user_id=$1 AND request_id=$2",
        [userId, requestId],
      );
      return this.search(row.rows[0]); // A completed pairing wins the cancellation race; return its room.
    });
  }
  private host(roomId: string): Promise<Hosted> {
    const existing = this.rooms.get(roomId);
    if (existing) return Promise.resolve(existing);
    const waiting = this.acquiring.get(roomId);
    if (waiting) return waiting;
    const attempt = (async () => {
      const acquired = await this.store.acquire(roomId);
      if (!acquired)
        throw new BreakthroughRoomError(
          "stale-owner",
          "Arena is recovering. Reconnect shortly.",
        );
      const entry: Hosted = {
        fence: acquired.checkpoint.ownerFence,
        until: acquired.leaseUntilMs,
        members: Object.values(acquired.checkpoint.members),
        owner: null!,
      };
      entry.owner = this.engine.owner({
        roomId,
        ownerFence: entry.fence,
        store: this.store,
        now: Date.now,
        leaseExpiresAt: () => entry.until,
      });
      this.rooms.set(roomId, entry);
      return entry;
    })();
    this.acquiring.set(roomId, attempt);
    void attempt
      .finally(() => this.acquiring.delete(roomId))
      .catch(() => undefined);
    return attempt;
  }
  private async authorize(
    roomId: string,
    userId: string,
  ): Promise<BreakthroughRoomCheckpoint> {
    if (!uuid.test(roomId)) invalid("Invalid arena ID.");
    const row = await this.options.pool.query(
      "SELECT checkpoint FROM breakthrough_rooms WHERE room_id=$1",
      [roomId],
    );
    if (!row.rowCount)
      throw new BreakthroughRoomError("room-not-found", "Arena not found.");
    const checkpoint = row.rows[0].checkpoint as BreakthroughRoomCheckpoint;
    if (!Object.values(checkpoint.members).includes(userId))
      throw new BreakthroughRoomError(
        "unauthorized",
        "You are not a member of this arena.",
      );
    return checkpoint;
  }
  async view(roomId: string, userId: string) {
    this.engine.admit();
    const hosted = this.rooms.get(roomId);
    if (hosted) return hosted.owner.view(userId);
    const checkpoint = await this.authorize(roomId, userId);
    if (checkpoint.phase !== "active")
      return projectBreakthroughRoom(checkpoint, userId);
    return (await this.host(roomId)).owner.view(userId);
  }
  async command(roomId: string, userId: string, envelope: unknown) {
    this.engine.admit();
    // Cached owners enforce seat authorization too. Never acquire a stranger's room on their request.
    if (!this.rooms.has(roomId)) {
      const checkpoint = await this.authorize(roomId, userId);
      if (checkpoint.phase !== "active") {
        const retry = commandBreakthroughRoom(
          checkpoint,
          userId,
          envelope,
          Date.now(),
        );
        if (!retry.journal) return retry.ack;
      }
    }
    const hosted = await this.host(roomId);
    const ack = await hosted.owner.command(userId, envelope);
    this.notify(roomId);
    return ack;
  }
  subscribe(roomId: string, notify: () => void): () => void {
    const list = this.listeners.get(roomId) ?? new Set();
    list.add(notify);
    this.listeners.set(roomId, list);
    return () => {
      list.delete(notify);
      if (!list.size) this.listeners.delete(roomId);
    };
  }
  private notify(roomId: string) {
    for (const notify of this.listeners.get(roomId) ?? []) notify();
  }
  async receipt(
    roomId: string,
    userId: string,
  ): Promise<BreakthroughReceipt | null> {
    this.engine.admit();
    if (!uuid.test(roomId)) invalid("Invalid arena ID.");
    // Membership and receipt in one small result: never transfer the full roster/checkpoint to poll a result.
    const r = await this.options.pool.query(
      `SELECT r.checkpoint->'members' AS members, p.receipt
       FROM breakthrough_rooms r LEFT JOIN breakthrough_receipts p
       ON p.room_id=r.room_id AND p.user_id=$2 WHERE r.room_id=$1`,
      [roomId, userId],
    );
    if (!r.rowCount)
      throw new BreakthroughRoomError("room-not-found", "Arena not found.");
    if (!Object.values(r.rows[0].members).includes(userId))
      throw new BreakthroughRoomError(
        "unauthorized",
        "You are not a member of this arena.",
      );
    return r.rows[0].receipt ?? null;
  }
  /** Unique terminal outbox + unique per-seat receipt; all records and outbox ack share one transaction. */
  async settle(): Promise<boolean> {
    return this.transaction(async (c) => {
      const pending =
        await c.query(`SELECT o.id,o.room_id,o.event,jsonb_build_object(
          'roomId',r.room_id,'phase',r.checkpoint->'phase',
          'members',r.checkpoint->'members','terminal',r.checkpoint->'terminal') AS checkpoint FROM breakthrough_room_outbox o JOIN breakthrough_rooms r ON r.room_id=o.room_id
        WHERE o.settled_at IS NULL ORDER BY o.created_at LIMIT 1 FOR UPDATE OF o SKIP LOCKED`);
      if (!pending.rowCount) return false;
      const row = pending.rows[0],
        room = row.checkpoint as BreakthroughRoomCheckpoint;
      if (
        !room.terminal ||
        room.terminal.id !== row.id ||
        room.phase === "active"
      )
        throw Error("Terminal checkpoint/outbox mismatch");
      const ids = Object.values(room.members).sort();
      for (const id of ids) {
        await c.query(
          "INSERT INTO breakthrough_records(user_id,season) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [id, BREAKTHROUGH_SEASON],
        );
        await c.query(
          "SELECT user_id FROM breakthrough_records WHERE user_id=$1 AND season=$2 FOR UPDATE",
          [id, BREAKTHROUGH_SEASON],
        );
      }
      for (const side of ["player", "opponent"] as const) {
        const user = room.members[side],
          other = room.members[side === "player" ? "opponent" : "player"];
        const previous = await c.query(
          "SELECT 1 FROM breakthrough_receipts WHERE room_id=$1 AND user_id=$2",
          [room.roomId, user],
        );
        if (previous.rowCount)
          throw Error("Partial settlement receipt; refusing to grant twice");
        const current = await c.query(
          "SELECT trophies FROM breakthrough_records WHERE user_id=$1 AND season=$2",
          [user, BREAKTHROUGH_SEASON],
        );
        const counts = await c.query(
          `SELECT count(*) FILTER (WHERE (receipt->>'eligible')::boolean)::int AS daily,
          count(*) FILTER (WHERE (receipt->>'eligible')::boolean AND opponent_id=$2)::int AS pair
          FROM breakthrough_receipts WHERE user_id=$1 AND settled_at >= date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
          [user, other],
        );
        const result = room.terminal.result;
        const outcome: BreakthroughReceipt["outcome"] =
          room.phase === "expired"
            ? "expired"
            : result.winner === "draw"
              ? "draw"
              : result.winner === side
                ? "win"
                : "loss";
        const exclusion: BreakthroughReceipt["exclusion"] =
          room.phase !== "complete" || result.reason === "surrender"
            ? "incomplete"
            : result.elapsedMs < 30000 ||
                Object.values(result.metrics).some((m) => m.deployments < 2)
              ? "insufficient-play"
              : counts.rows[0].daily >= 20
                ? "daily-cap"
                : counts.rows[0].pair >= 3
                  ? "opponent-cap"
                  : null;
        const before = current.rows[0].trophies,
          after = exclusion
            ? before
            : Math.max(
                0,
                before + (outcome === "win" ? 20 : outcome === "draw" ? 3 : -6),
              );
        const receipt: BreakthroughReceipt = {
          roomId: room.roomId,
          policy: BREAKTHROUGH_REWARD_POLICY,
          season: BREAKTHROUGH_SEASON,
          outcome,
          eligible: !exclusion,
          exclusion,
          before,
          after,
          delta: after - before,
        };
        await c.query(
          "INSERT INTO breakthrough_receipts(room_id,user_id,opponent_id,season,receipt) VALUES($1,$2,$3,$4,$5)",
          [
            room.roomId,
            user,
            other,
            BREAKTHROUGH_SEASON,
            JSON.stringify(receipt),
          ],
        );
        await c.query(
          `UPDATE breakthrough_records SET trophies=$3,wins=wins+$4,losses=losses+$5,draws=draws+$6 WHERE user_id=$1 AND season=$2`,
          [
            user,
            BREAKTHROUGH_SEASON,
            after,
            Number(!exclusion && outcome === "win"),
            Number(!exclusion && outcome === "loss"),
            Number(!exclusion && outcome === "draw"),
          ],
        );
      }
      await c.query(
        "UPDATE breakthrough_searches SET status='complete' WHERE room_id=$1 AND status='paired'",
        [room.roomId],
      );
      await c.query(
        "UPDATE breakthrough_room_outbox SET settled_at=clock_timestamp() WHERE id=$1",
        [row.id],
      );
      return true;
    });
  }
  async cycle(): Promise<void> {
    if (this.stopping) return;
    this.engine.admit();
    if (Date.now() >= this.scanAt) {
      this.scanAt = Date.now() + (this.rooms.size ? 1000 : 15000);
      const expired = await this.options.pool.query(
        "SELECT room_id FROM breakthrough_rooms WHERE checkpoint->>'phase'='active' AND lease_until<=clock_timestamp() LIMIT 100",
      );
      for (const row of expired.rows)
        await this.host(row.room_id).catch(this.options.report);
      // Drain a bounded batch; busy result queues should not leave players polling for minutes.
      for (let i = 0; i < 10 && (await this.settle()); i++)
        this.scanAt = Date.now() + 1000;
    }
    await Promise.all(
      [...this.rooms].map(async ([id, entry]) => {
        try {
          if (entry.until - Date.now() < 10000) {
            const until = await this.store.renew(id, entry.fence);
            if (!until)
              throw new BreakthroughRoomError(
                "stale-owner",
                "Room lease was lost",
              );
            entry.until = until;
          }
          await entry.owner.tick();
          this.notify(id);
          const view = await entry.owner.view(entry.members[0]);
          if (view.phase !== "active") {
            await entry.owner.close();
            this.rooms.delete(id);
            this.scanAt = 0; // Wake settlement immediately even when the last room finishes.
          }
        } catch (e) {
          this.rooms.delete(id);
          this.notify(id);
          this.options.report(e);
        }
      }),
    );
  }
  start() {
    this.engine.admit();
    const run = () => {
      this.running = this.cycle()
        .catch(this.options.report)
        .finally(() => {
          if (!this.stopping) this.timer = setTimeout(run, 50);
        });
    };
    run();
  }
  async stop() {
    this.stopping = true;
    clearTimeout(this.timer);
    await this.running;
    await Promise.all(
      [...this.rooms.values()].map((r) =>
        r.owner.close().catch(this.options.report),
      ),
    );
    this.rooms.clear();
  }
}
