import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playerProfilesTable } from "./playerProfiles";

export type CollectionRoadRewardRecord = {
  /** Alert receipts are durable account state, not rewards. They share this
   * per-player idempotent ledger so logout, a new browser, or a new deploy
   * cannot resurrect already-read alerts. */
  notificationReceipt?: { id: string };
  accountReward?: { key: string; title: string; softCurrency: number; packTickets: number; styleShards: number; streak?: number; date?: string };
  stockzBet?: { id: string; ticker: string; direction: 'up' | 'down'; stake: number; openPrice: number; closePrice: number; startedAt: string; closesAt: string; date: string };
  stockzSettlement?: { betId: string; payout: number };
  /** Promo receipts use a permanent per-account key, independent of request retries. */
  promoCode?: { code: string; packTickets: number; softCurrency: number; styleShards: number; cardIds?: string[] };
  /** Namespaced shop receipts share the existing immutable, per-player claim ledger. */
  shopPurchase?: { itemId: string; cardId: string | null; cost: number; currency: 'softCurrency' | 'styleShards'; summary: string; shardPayment?: { rarity: string; matching: number; universal: number } };
  /** Durable minigame run snapshots; profile lock serializes actions and reward banking. */
  arcadeRun?: { version: 1; runId: string; period: string; kind: string; state: unknown; earned: {softCurrency:number;packTickets:number;styleShards:number}; lastActionId?: string };
  bossCampaign?: {version:2;state:unknown};
  bossRaid?: {version:1;runId:string;day:string;state:unknown;earned:{softCurrency:number;packTickets:number;styleShards:number};lastActionId?:string};
  waffleRun?: { version: 1; runId: string; day: string; state: unknown; earned: {softCurrency:number;packTickets:number;styleShards:number}; lastActionId?: string };
  /** Unlimited chess runs use permanent start/action receipts and one win payout. */
  parkChessCampaign?: { version: 1; state: unknown };
  parkChessRun?: {
    version: 1; runId: string; state: unknown; packTickets: number; startedAt: string; completedAt: string | null;
    /** Missing for games started before Park Rating; those games finish unrated. */
    ratingBefore?: { value: number; games: number; peak: number };
    opponentRating?: number;
    ratingChange?: { before: number; after: number; delta: number; opponent: number; result: "win" | "loss" | "draw" } | null;
  };
  /** tier records the actual resumed/new game; requestedTier locks client intent. */
  parkChessStart?: { runId: string; tier?: number; requestedTier?: number | null };
  parkChessAction?: { runId: string; actionId: string; revision: number; fingerprint: string };
  starterMythic?: { cardId: string; softCurrency: number; packTickets: number; duplicateShards: number };
  cardId?: string;
  softCurrency?: number;
  styleShards?: number;
  deckSlots?: number;
  duplicateShards?: number;
};

export const playerCollectionClaimsTable = pgTable(
  "player_collection_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    milestoneKey: text("milestone_key").notNull(),
    reward: jsonb("reward").$type<CollectionRoadRewardRecord>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("player_collection_claims_user_milestone_unique").on(
      table.clerkUserId,
      table.milestoneKey,
    ),
  ],
);

export const insertPlayerCollectionClaimSchema = createInsertSchema(
  playerCollectionClaimsTable,
).omit({ id: true, createdAt: true });

export type InsertPlayerCollectionClaim = z.infer<
  typeof insertPlayerCollectionClaimSchema
>;
export type PlayerCollectionClaimRecord =
  typeof playerCollectionClaimsTable.$inferSelect;
