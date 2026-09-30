import { check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { playerProfilesTable } from "./playerProfiles";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type PatchContent = {
  version: string;
  title: string;
  date: string;
  overview: string;
  buffs: string[];
  changes: string[];
  softCurrency: number;
  packTickets: number;
};

export const patchDraftsTable = pgTable("patch_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: text("version").notNull(),
  title: text("title").notNull(),
  patchDate: date("patch_date", { mode: "string" }).notNull(),
  overview: text("overview").notNull(),
  buffs: jsonb("buffs").$type<string[]>().notNull().default([]),
  changes: jsonb("changes").$type<string[]>().notNull().default([]),
  softCurrency: integer("soft_currency").notNull().default(50),
  packTickets: integer("pack_tickets").notNull().default(0),
  status: text("status").$type<"draft" | "published">().notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdBy: text("created_by").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: text("published_by"),
  intendedCount: integer("intended_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  lastError: text("last_error"),
  campaignId: text("campaign_id"),
}, table => [
  uniqueIndex("patch_drafts_version_unique").on(table.version),
  check("patch_drafts_status_check", sql`${table.status} IN ('draft', 'published')`),
  check("patch_drafts_gift_check", sql`${table.softCurrency} BETWEEN 0 AND 100 AND ${table.packTickets} BETWEEN 0 AND 1`),
  check("patch_drafts_counts_check", sql`${table.intendedCount} >= 0 AND ${table.deliveredCount} >= 0 AND ${table.failedCount} >= 0`),
  index("patch_drafts_public_order").on(table.publishedAt.desc()),
]);

export const patchDeliveryTargetsTable = pgTable("patch_delivery_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  patchId: uuid("patch_id").notNull().references(() => patchDraftsTable.id, { onDelete: "cascade" }),
  // Keep the immutable publish-time recipient snapshot even if a profile is
  // deleted before delivery; the worker marks such rows terminally missing.
  clerkUserId: text("clerk_user_id").notNull(),
  status: text("status").$type<"pending" | "delivered" | "failed" | "missing">().notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
}, table => [
  uniqueIndex("patch_delivery_patch_user_unique").on(table.patchId, table.clerkUserId),
  check("patch_delivery_status_check", sql`${table.status} IN ('pending', 'delivered', 'failed', 'missing')`),
  index("patch_delivery_work_queue").on(table.patchId, table.status, table.clerkUserId),
]);

export const insertPatchDraftSchema = createInsertSchema(patchDraftsTable);
export type PatchDraftRecord = typeof patchDraftsTable.$inferSelect;
export type PatchDeliveryTargetRecord = typeof patchDeliveryTargetsTable.$inferSelect;