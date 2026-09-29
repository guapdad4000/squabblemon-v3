import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { playerProfilesTable } from "./playerProfiles";

export const eventFeedbackTable = pgTable("event_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().references(() => playerProfilesTable.clerkUserId, { onDelete: "cascade" }),
  retryId: uuid("retry_id").notNull(),
  displayName: text("display_name").notNull(),
  category: text("category").$type<"bug" | "suggestion" | "general">().notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, table => [
  check("event_feedback_category_check", sql`${table.category} IN ('bug', 'suggestion', 'general')`),
  check("event_feedback_message_check", sql`char_length(${table.message}) BETWEEN 1 AND 2000 AND ${table.message} = btrim(${table.message})`),
  check("event_feedback_display_name_check", sql`char_length(${table.displayName}) BETWEEN 1 AND 200`),
  uniqueIndex("event_feedback_author_retry_unique").on(table.clerkUserId, table.retryId),
  index("event_feedback_feed_order").on(table.createdAt.desc(), table.id.desc()),
  index("event_feedback_author_time").on(table.clerkUserId, table.createdAt.desc()),
]);
export const insertEventFeedbackSchema = createInsertSchema(eventFeedbackTable);
export type EventFeedbackRecord = typeof eventFeedbackTable.$inferSelect;