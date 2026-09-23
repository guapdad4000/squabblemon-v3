import { integer, jsonb, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { playerProfilesTable } from "./playerProfiles";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const challengeRunsTable = pgTable("challenge_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().references(() => playerProfilesTable.clerkUserId, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"),
  seed: integer("seed").notNull(),
  encounterIndex: integer("encounter_index").notNull().default(0),
  score: integer("score").notNull().default(0),
  entryDate: text("entry_date").notNull(),
  entryNumber: integer("entry_number").notNull(),
  wins: integer("wins").notNull().default(0),
  crewSnapshot: jsonb("crew_snapshot").notNull().$type<Record<string, unknown>>(),
  encounterSnapshot: jsonb("encounter_snapshot").notNull().$type<Record<string, unknown>>(),
  checkpoints: jsonb("checkpoints").notNull().$type<Array<Record<string, unknown>>>(),
  transcripts: jsonb("transcripts").notNull().$type<Array<Record<string, unknown>>>(),
  rewardGrantedAt: timestamp("reward_granted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({ activeUser: uniqueIndex("challenge_runs_one_active_user").on(table.clerkUserId).where(sql`status = 'active'`) }));

// Kept as a type-only import workaround for drizzle's callback scope.
import { sql } from "drizzle-orm";
export const insertChallengeRunSchema = createInsertSchema(challengeRunsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChallengeRun = z.infer<typeof insertChallengeRunSchema>;
export type ChallengeRunRecord = typeof challengeRunsTable.$inferSelect;