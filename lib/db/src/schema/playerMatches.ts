import {
  boolean,
  integer,
  jsonb,
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
  challengeRunId: uuid("challenge_run_id"),
  playerDeckId: text("player_deck_id").notNull(),
  rivalDeckId: text("rival_deck_id").notNull(),
  storyNodeId: text("story_node_id"),
  storyContentVersion: integer("story_content_version"),
  storyEncounterSnapshot: jsonb("story_encounter_snapshot")
    .$type<Record<string, unknown>>(),
  storyProgressionSnapshot: jsonb("story_progression_snapshot")
    .$type<Record<string, unknown>>(),
  playerEngineCardIds: jsonb("player_engine_card_ids").$type<string[]>(),
  playerCardProgressionSnapshot: jsonb("player_card_progression_snapshot")
    .$type<{
      turnRulesVersion?: 1 | 2;
      balanceRulesVersion?: number;
      economyVersion?: string;
      districtSnapshot?: Record<string, unknown>;
      version: number;
      cards: Array<{ cardId: string; xp: number; level: number }>;
      abilityUpgradeSnapshot: {
        version: number;
        player: Array<{ cardId: string; level: number; upgradeIds: string[] }>;
        cpu: Array<{ cardId: string; level: number; upgradeIds: string[] }>;
      };
    }>(),
  cardXpRewards: jsonb("card_xp_rewards")
    .$type<Array<{
      cardId: string;
      xpGained: number;
      previousXp: number;
      previousLevel: number;
      xp: number;
      level: number;
    }>>(),
  storyFirstClear: boolean("story_first_clear"),
  storyStars: integer("story_stars"),
  storyBossHighestPhase: integer("story_boss_highest_phase"),
  storyGrantedRewards: jsonb("story_granted_rewards")
    .$type<Array<Record<string, unknown>>>(),
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
