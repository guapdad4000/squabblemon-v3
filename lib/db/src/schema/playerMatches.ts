import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playerProfilesTable } from "./playerProfiles";

export const playerMatchesTable = pgTable("player_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id")
    .notNull()
    .references(() => playerProfilesTable.clerkUserId, {
      onDelete: "cascade",
    }),
  mode: text("mode").notNull(),
  playerDeckId: text("player_deck_id").notNull(),
  rivalDeckId: text("rival_deck_id").notNull(),
  outcome: text("outcome"),
  rounds: integer("rounds"),
  districtsWon: integer("districts_won"),
  rewardXp: integer("reward_xp"),
  rewardStreetRep: integer("reward_street_rep"),
  rewardSoftCurrency: integer("reward_soft_currency"),
  rewardPackTickets: integer("reward_pack_tickets"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertPlayerMatchSchema = createInsertSchema(
  playerMatchesTable,
).omit({ id: true, createdAt: true });

export type InsertPlayerMatch = z.infer<typeof insertPlayerMatchSchema>;
export type PlayerMatchRecord = typeof playerMatchesTable.$inferSelect;
