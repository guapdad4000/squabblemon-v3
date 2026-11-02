import { jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
/** One bounded record per named rival per season, never a synthetic player account. */
export const parkRivalStandingsTable = pgTable('park_rival_standings', {
  season: text('season').notNull(),
  personaId: text('persona_id').notNull(),
  stats: jsonb('stats').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.season, table.personaId] })]);
