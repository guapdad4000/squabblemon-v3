import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playerProfilesTable } from "./playerProfiles";

export const playerMissionsTable = pgTable(
  "player_missions",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    missionKey: text("mission_key").notNull(),
    cadence: text("cadence").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    progress: integer("progress").notNull().default(0),
    goal: integer("goal").notNull(),
    rewardCurrency: text("reward_currency").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("player_missions_user_key_unique").on(
      table.clerkUserId,
      table.missionKey,
    ),
  ],
);

export const insertPlayerMissionSchema = createInsertSchema(
  playerMissionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertPlayerMission = z.infer<typeof insertPlayerMissionSchema>;
export type PlayerMissionRecord = typeof playerMissionsTable.$inferSelect;
