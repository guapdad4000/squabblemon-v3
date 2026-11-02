import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  jsonb,
  timestamp,
  integer,
  primaryKey,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { breakthroughRoomsTable } from "./breakthroughRooms";
export const breakthroughSearchesTable = pgTable(
  "breakthrough_searches",
  {
    userId: text("user_id").notNull(),
    requestId: uuid("request_id").notNull(),
    deckId: text("deck_id").notNull(),
    member: jsonb("member").notNull(),
    status: text("status").notNull(),
    roomId: text("room_id").references(() => breakthroughRoomsTable.roomId),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.requestId] }),
    uniqueIndex("breakthrough_searches_active_player")
      .on(t.userId)
      .where(sql`${t.status} IN ('waiting','paired')`),
    index("breakthrough_searches_waiting")
      .on(t.createdAt)
      .where(sql`${t.status}='waiting'`),
    index("breakthrough_searches_room")
      .on(t.roomId)
      .where(sql`${t.roomId} IS NOT NULL`),
    check(
      "breakthrough_searches_status_check",
      sql`${t.status} IN ('waiting','paired','cancelled','complete')`,
    ),
  ],
);
export const breakthroughRecordsTable = pgTable(
  "breakthrough_records",
  {
    userId: text("user_id").notNull(),
    season: text("season").notNull(),
    trophies: integer("trophies").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.season] }),
    check("breakthrough_records_trophies_check", sql`${t.trophies}>=0`),
  ],
);
export const breakthroughReceiptsTable = pgTable(
  "breakthrough_receipts",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => breakthroughRoomsTable.roomId),
    userId: text("user_id").notNull(),
    opponentId: text("opponent_id").notNull(),
    season: text("season").notNull(),
    receipt: jsonb("receipt").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.userId] }),
    index("breakthrough_receipts_daily").on(t.userId, t.settledAt),
  ],
);
