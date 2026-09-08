import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { playerProfilesTable } from "./playerProfiles";

export type PlayerStoryBossProgress = {
  highestPhase: number;
};

export type PlayerStoryReward = {
  kind: "currency" | "card" | "chapter-key" | "pack-ticket" | "cosmetic";
  id: string;
  amount: number;
  duplicateShards?: number;
};

export const playerStoryNodesTable = pgTable(
  "player_story_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    chapterId: text("chapter_id").notNull(),
    nodeId: text("node_id").notNull(),
    cleared: boolean("cleared").notNull().default(false),
    stars: integer("stars").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    lastOutcome: text("last_outcome"),
    dialogueSeen: jsonb("dialogue_seen").$type<string[]>().notNull().default([]),
    bossProgress: jsonb("boss_progress")
      .$type<PlayerStoryBossProgress>()
      .notNull()
      .default({ highestPhase: 0 }),
    firstClearedAt: timestamp("first_cleared_at", { withTimezone: true }),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("player_story_nodes_user_node_unique").on(
      table.clerkUserId,
      table.nodeId,
    ),
    check("player_story_nodes_stars_range", sql`${table.stars} between 0 and 3`),
    check("player_story_nodes_attempts_nonnegative", sql`${table.attempts} >= 0`),
    check("player_story_nodes_wins_nonnegative", sql`${table.wins} >= 0`),
  ],
);

export const playerStoryRewardClaimsTable = pgTable(
  "player_story_reward_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    chapterId: text("chapter_id").notNull(),
    nodeId: text("node_id").notNull(),
    rewardKey: text("reward_key").notNull(),
    reward: jsonb("reward").$type<PlayerStoryReward>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("player_story_reward_claims_user_reward_unique").on(
      table.clerkUserId,
      table.rewardKey,
    ),
  ],
);

export type PlayerStoryActionPayload = {
  dialogueSeen: string[];
};

export const playerStoryActionsTable = pgTable(
  "player_story_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    idempotencyKey: text("idempotency_key").notNull(),
    nodeId: text("node_id").notNull(),
    actionKind: text("action_kind").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    payload: jsonb("payload").$type<PlayerStoryActionPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("player_story_actions_user_key_unique").on(
      table.clerkUserId,
      table.idempotencyKey,
    ),
  ],
);

export type PlayerStoryNodeRecord =
  typeof playerStoryNodesTable.$inferSelect;
export type PlayerStoryRewardClaimRecord =
  typeof playerStoryRewardClaimsTable.$inferSelect;
export type PlayerStoryActionRecord =
  typeof playerStoryActionsTable.$inferSelect;