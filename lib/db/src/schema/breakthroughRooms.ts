import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
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
    workerWakeAt: timestamp('worker_wake_at', {withTimezone: true}).notNull().default(sql`'1970-01-01T00:00:00Z'`),
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

/** Short-lived transport only; private game authority remains in rooms/journal. */
export const breakthroughTransportTable = pgTable('breakthrough_transport', {
  id: bigserial('id', {mode:'number'}).primaryKey(),
  channel: text('channel').notNull(),
  payload: text('payload').notNull(),
  expiresAt: timestamp('expires_at', {withTimezone:true}).notNull(),
}, t => [
  index('breakthrough_transport_channel').on(t.channel,t.id),
  index('breakthrough_transport_expiry').on(t.expiresAt),
  check('breakthrough_transport_channel_check',sql`${t.channel} ~ '^bt_[a-z0-9_]{1,59}$'`),
  check('breakthrough_transport_payload_check',sql`length(${t.payload}) <= 2800000`),
]);
