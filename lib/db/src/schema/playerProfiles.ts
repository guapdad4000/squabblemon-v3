import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type PlayerSettings = {
  reducedMotion: boolean;
  turnTimerEnabled: boolean;
};

export type SavedDeck = {
  id: string;
  name: string;
  cardIds: string[];
  heroCardId?: string;
  recipeId?: string | null;
};

export const playerProfilesTable = pgTable("player_profiles", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  displayName: text("display_name").notNull().default("New Challenger"),
  avatarKey: text("avatar_key").notNull().default("rastamon"),
  onboardingStep: text("onboarding_step").notNull().default("profile"),
  starterDeckId: text("starter_deck_id"),
  streetRep: integer("street_rep").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  softCurrency: integer("soft_currency").notNull().default(0),
  packTickets: integer("pack_tickets").notNull().default(0),
  styleShards: integer("style_shards").notNull().default(0),
  packPity: integer("pack_pity").notNull().default(0),
  deckSlots: integer("deck_slots").notNull().default(4),
  cosmeticCurrency: integer("cosmetic_currency").notNull().default(0),
  collectionProgress: integer("collection_progress").notNull().default(0),
  storyChapter: integer("story_chapter").notNull().default(1),
  storyNode: integer("story_node").notNull().default(0),
  tutorialCompleted: boolean("tutorial_completed").notNull().default(false),
  starterRewardClaimed: boolean("starter_reward_claimed")
    .notNull()
    .default(false),
  ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  settings: jsonb("settings")
    .$type<PlayerSettings>()
    .notNull()
    .default({ reducedMotion: false, turnTimerEnabled: true }),
  ownedCardIds: jsonb("owned_card_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  discoveredCardIds: jsonb("discovered_card_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  ownedVariants: jsonb("owned_variants")
    .$type<string[]>()
    .notNull()
    .default([]),
  unlockedCosmeticIds: jsonb("unlocked_cosmetic_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  savedDecks: jsonb("saved_decks")
    .$type<SavedDeck[]>()
    .notNull()
    .default([]),
  storyProgress: jsonb("story_progress")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  inbox: jsonb("inbox")
    .$type<Array<Record<string, unknown>>>()
    .notNull()
    .default([]),
  packHistory: jsonb("pack_history")
    .$type<Array<Record<string, unknown>>>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPlayerProfileSchema = createInsertSchema(
  playerProfilesTable,
).omit({ createdAt: true, updatedAt: true, lastActiveAt: true });

export type InsertPlayerProfile = z.infer<typeof insertPlayerProfileSchema>;
export type PlayerProfileRecord = typeof playerProfilesTable.$inferSelect;
