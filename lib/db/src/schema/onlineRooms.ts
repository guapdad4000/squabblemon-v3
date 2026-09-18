import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { playerProfilesTable } from "./playerProfiles";

export const onlineRoomsTable = pgTable(
  "online_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    hostUserId: text("host_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    guestUserId: text("guest_user_id").references(
      () => playerProfilesTable.clerkUserId,
      { onDelete: "cascade" },
    ),
    createRequestId: uuid("create_request_id").notNull(),
    state: jsonb("state").$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("online_rooms_create_once").on(
      table.hostUserId,
      table.createRequestId,
    ),
    index("online_rooms_host").on(table.hostUserId),
    index("online_rooms_guest").on(table.guestUserId),
  ],
);

export const onlineCommandsTable = pgTable(
  "online_commands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => onlineRoomsTable.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    userId: text("user_id").notNull(),
    requestId: uuid("request_id").notNull(),
    command: jsonb("command").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("online_commands_request_once").on(
      table.roomId,
      table.userId,
      table.requestId,
    ),
    uniqueIndex("online_commands_revision").on(table.roomId, table.revision),
  ],
);
