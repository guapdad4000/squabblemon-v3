import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  unique,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { playerProfilesTable } from "./playerProfiles";
export const communityDecksTable = pgTable(
  "community_decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    week: text("week").notNull(),
    name: text("name").notNull(),
    strategy: text("strategy").notNull(),
    cardIds: jsonb("card_ids").$type<string[]>().notNull(),
    heroCardId: text("hero_card_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("community_decks_author_week").on(table.clerkUserId, table.week),
    index("community_decks_week_order").on(
      table.week,
      table.createdAt,
      table.id,
    ),
    check(
      "community_decks_name_check",
      sql`length(${table.name}) between 1 and 60`,
    ),
    check(
      "community_decks_strategy_check",
      sql`length(${table.strategy}) between 1 and 280`,
    ),
    check(
      "community_decks_cards_check",
      sql`jsonb_typeof(${table.cardIds})='array' and jsonb_array_length(${table.cardIds})=10`,
    ),
  ],
);
export const communityDeckVotesTable = pgTable(
  "community_deck_votes",
  {
    deckId: uuid("deck_id")
      .notNull()
      .references(() => communityDecksTable.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => playerProfilesTable.clerkUserId, {
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.deckId, table.clerkUserId] }),
    index("community_deck_votes_author").on(table.clerkUserId),
  ],
);
