import { boolean, check, integer, jsonb, pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { playerProfilesTable } from './playerProfiles';

export const paymentOrdersTable = pgTable('payment_orders', {
  id: text('id').primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().references(() => playerProfilesTable.clerkUserId),
  idempotencyKey: text('idempotency_key').notNull(),
  offerId: text('offer_id').notNull(),
  offerName: text('offer_name').notNull(),
  catalogVersion: text('catalog_version').notNull(),
  mode: text('mode').$type<'test' | 'live'>().notNull(),
  currency: text('currency').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  clout: integer('clout').notNull(),
  priceId: text('price_id').notNull(),
  taxMode: text('tax_mode').$type<'none' | 'automatic'>().notNull().default('none'),
  productId: text('product_id'),
  taxCode: text('tax_code'),
  taxAmountMinor: integer('tax_amount_minor'),
  totalAmountMinor: integer('total_amount_minor'),
  status: text('status').$type<'pending' | 'processing' | 'fulfilled' | 'failed' | 'expired' | 'refunded' | 'disputed'>().notNull().default('pending'),
  sessionId: text('session_id'),
  paymentIntentId: text('payment_intent_id'),
  checkoutUrl: text('checkout_url'),
  sessionParams: jsonb('session_params').$type<Record<string, unknown>>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  disputedAt: timestamp('disputed_at', { withTimezone: true }),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
  refundedAmountMinor: integer('refunded_amount_minor').notNull().default(0),
  disputed: boolean('disputed').notNull().default(false),
}, table => [
  check('payment_order_tax_snapshot', sql`(
    (${table.taxMode} = 'none' AND ${table.productId} IS NULL AND ${table.taxCode} IS NULL AND
      ((${table.taxAmountMinor} IS NULL AND ${table.totalAmountMinor} IS NULL) OR
       (${table.taxAmountMinor} IS NOT NULL AND ${table.totalAmountMinor} IS NOT NULL AND ${table.taxAmountMinor} = 0 AND ${table.totalAmountMinor} = ${table.amountMinor})))
    OR (${table.taxMode} = 'automatic' AND ${table.productId} IS NOT NULL AND ${table.taxCode} IS NOT NULL AND
      ((${table.taxAmountMinor} IS NULL AND ${table.totalAmountMinor} IS NULL) OR
       (${table.taxAmountMinor} IS NOT NULL AND ${table.totalAmountMinor} IS NOT NULL AND
        ${table.taxAmountMinor} >= 0 AND ${table.totalAmountMinor}::bigint = ${table.amountMinor}::bigint + ${table.taxAmountMinor}::bigint)))
  )`),
  uniqueIndex('payment_order_request_unique').on(table.clerkUserId, table.idempotencyKey),
  uniqueIndex('payment_order_session_unique').on(table.sessionId),
  uniqueIndex('payment_order_intent_unique').on(table.paymentIntentId),
  index('payment_order_owner_created').on(table.clerkUserId, table.createdAt),
]);
export const insertPaymentOrderSchema = createInsertSchema(paymentOrdersTable);
export type PaymentOrder = typeof paymentOrdersTable.$inferSelect;
export type InsertPaymentOrder = typeof paymentOrdersTable.$inferInsert;

export const paymentEventsTable = pgTable('payment_events', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => paymentOrdersTable.id),
  type: text('type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const insertPaymentEventSchema = createInsertSchema(paymentEventsTable);
export type PaymentEvent = typeof paymentEventsTable.$inferSelect;

export const paymentFulfillmentsTable = pgTable('payment_fulfillments', {
  orderId: text('order_id').primaryKey().references(() => paymentOrdersTable.id),
  clout: integer('clout').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const insertPaymentFulfillmentSchema = createInsertSchema(paymentFulfillmentsTable);
export type PaymentFulfillment = typeof paymentFulfillmentsTable.$inferSelect;