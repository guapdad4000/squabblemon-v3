import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const kumiteTournamentsTable = pgTable('kumite_tournaments', {
  id: text('id').primaryKey(),
  state: jsonb('state').$type<Record<string, unknown>>().notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Historical identity is a frozen snapshot and survives later profile/name changes. */
export const kumiteWinnersTable = pgTable('kumite_winners', {
  tournamentId: text('tournament_id').primaryKey(),
  weekLabel: text('week_label').notNull(),
  champion: jsonb('champion').$type<{ name: string; hero: string; avatarKey?: string; entrantCount: number }>().notNull(),
  wonAt: timestamp('won_at', { withTimezone: true }).notNull(),
});
