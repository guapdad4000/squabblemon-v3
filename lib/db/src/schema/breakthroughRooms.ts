import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
export const breakthroughRoomsTable = pgTable(
  'breakthrough_rooms',
  {
    roomId: text('room_id').primaryKey(),
    ownerFence: bigint('owner_fence', { mode: 'number' }).notNull(),
    leaseUntil: timestamp('lease_until', { withTimezone: true }).notNull(),
    revision: bigint('revision', { mode: 'number' }).notNull(),
    checkpointRevision: bigint('checkpoint_revision', {
      mode: 'number',
    }).notNull(),
    checkpoint: jsonb('checkpoint').notNull().$type<Record<string, unknown>>(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    check('breakthrough_rooms_owner_fence_check', sql`${t.ownerFence} > 0`),
    check('breakthrough_rooms_revision_check', sql`${t.revision} >= 0`),
    check(
      'breakthrough_rooms_check',
      sql`${t.checkpointRevision} <= ${t.revision}`,
    ),
  ],
);
export const breakthroughRoomJournalTable = pgTable(
  'breakthrough_room_journal',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => breakthroughRoomsTable.roomId, { onDelete: 'cascade' }),
    revision: bigint('revision', { mode: 'number' }).notNull(),
    entry: jsonb('entry').notNull().$type<Record<string, unknown>>(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.revision] })],
);
export const breakthroughRoomOutboxTable = pgTable(
  'breakthrough_room_outbox',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => breakthroughRoomsTable.roomId),
    event: jsonb('event').notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (t) => [
    index('breakthrough_room_outbox_pending')
      .on(t.createdAt)
      .where(sql`${t.settledAt} IS NULL`),
  ],
);
