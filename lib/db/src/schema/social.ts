import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer, uniqueIndex, index, check, primaryKey } from "drizzle-orm/pg-core";
import { playerProfilesTable } from "./playerProfiles";
import { onlineRoomsTable } from "./onlineRooms";

const account = (name: string) => text(name).notNull().references(() => playerProfilesTable.clerkUserId, { onDelete: "cascade" });
const time = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const socialIdentitiesTable = pgTable("social_identities", {
  userId: account("user_id").primaryKey(), friendCode: text("friend_code").notNull().unique(),
  username: text("username"),
}, t => [check("social_friend_code_format", sql`${t.friendCode} ~ '^[A-F0-9]{12}$'`),
  uniqueIndex("social_username_unique").on(t.username),
  check("social_username_format", sql`${t.username} ~ '^[a-z0-9_]{3,24}$'`),
  check("social_username_reserved", sql`${t.username} not in ('admin','administrator','system','support','moderator','mod','official','fadebook','squabblemon','deleted','null','undefined')`)]);
export const socialRelationshipsTable = pgTable("social_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  low: account("low_user_id"), high: account("high_user_id"), sender: account("sender_user_id"),
  status: text("status").notNull(), createdAt: time("created_at"), updatedAt: time("updated_at"),
}, t => [uniqueIndex("social_pair_once").on(t.low, t.high), check("social_pair_order", sql`${t.low} < ${t.high}`),
  check("social_sender_member", sql`${t.sender} in (${t.low}, ${t.high})`),
  check("social_relationship_status", sql`${t.status} in ('pending','homie','declined','cancelled','removed')`),
  index("social_relationship_high").on(t.high)]);
export const socialBlocksTable = pgTable("social_blocks", {
  userId: account("user_id"), targetId: account("target_id"), createdAt: time("created_at"),
}, t => [primaryKey({ columns: [t.userId, t.targetId] }), check("social_block_not_self", sql`${t.userId} <> ${t.targetId}`)]);
export const socialInvitationsTable = pgTable("social_invitations", {
  id: uuid("id").primaryKey().defaultRandom(), sender: account("sender_user_id"), recipient: account("recipient_user_id"),
  low: account("low_user_id"), high: account("high_user_id"),
  roomId: uuid("room_id").notNull().unique().references(() => onlineRoomsTable.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull(), deckId: text("deck_id").notNull(),
  status: text("status").notNull().default("pending"), expiresAt: time("expires_at"), createdAt: time("created_at"),
}, t => [uniqueIndex("social_invite_request_once").on(t.sender, t.requestId),
  uniqueIndex("social_invite_active_pair").on(t.low, t.high).where(sql`${t.status} = 'pending'`),
  index("social_invite_recipient").on(t.recipient),
  check("social_invite_pair_order", sql`${t.low} < ${t.high}`),
  check("social_invite_members", sql`${t.sender} <> ${t.recipient} and ${t.sender} in (${t.low}, ${t.high}) and ${t.recipient} in (${t.low}, ${t.high})`),
  check("social_invite_status", sql`${t.status} in ('pending','accepted','declined','cancelled','expired','unavailable','closed')`)]);
export const socialThrottleTable = pgTable("social_throttle", {
  userId: account("user_id"), action: text("action").notNull(), windowAt: time("window_at"), count: integer("count").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.action] })]);