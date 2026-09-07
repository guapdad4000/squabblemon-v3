import {
  index,
  integer,
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

export type PackRewardRecord = {
  kind: "card" | "styleShards" | "softCurrency" | "variant";
  cardId: string | null;
  variantId: string | null;
  name: string | null;
  rarity: string | null;
  isNew: boolean;
  amount: number;
};

export const playerPackOpeningsTable = pgTable(
  "player_pack_openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    idempotencyKey: text("idempotency_key").notNull(),
    oddsVersion: text("odds_version").notNull(),
    paymentMethod: text("payment_method").notNull(),
    cost: integer("cost").notNull(),
    rewards: jsonb("rewards").$type<PackRewardRecord[]>().notNull(),
    pityBefore: integer("pity_before").notNull(),
    pityAfter: integer("pity_after").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("player_pack_openings_user_key_unique").on(
      table.clerkUserId,
      table.idempotencyKey,
    ),
    index("player_pack_openings_user_created_idx").on(
      table.clerkUserId,
      table.createdAt,
    ),
  ],
);

export const insertPlayerPackOpeningSchema = createInsertSchema(
  playerPackOpeningsTable,
).omit({ id: true, createdAt: true });

export type InsertPlayerPackOpening = z.infer<
  typeof insertPlayerPackOpeningSchema
>;
export type PlayerPackOpeningRecord =
  typeof playerPackOpeningsTable.$inferSelect;