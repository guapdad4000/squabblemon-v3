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
  accountReward?: { key: string; title: string; softCurrency: number; packTickets: number; styleShards: number; streak?: number; date?: string };
  stockzBet?: { id: string; ticker: string; direction: 'up' | 'down'; stake: number; openPrice: number; closePrice: number; startedAt: string; closesAt: string; date: string };
  stockzSettlement?: { betId: string; payout: number };
  /** Promo receipts use a permanent per-account key, independent of request retries. */
  promoCode?: { code: string; packTickets: number; softCurrency: number; styleShards: number; cardIds?: string[] };
  /** Namespaced shop receipts share the existing immutable, per-player claim ledger. */
  shopPurchase?: { itemId: string; cardId: string | null; cost: number; currency: 'softCurrency' | 'styleShards'; summary: string };
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
