import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db, paymentOrdersTable as orders, paymentEventsTable as events, paymentFulfillmentsTable as fulfillments, playerProfilesTable as profiles, type PaymentOrder } from '@workspace/db';
import type Stripe from 'stripe';
import type { RuntimeDeploymentContext } from '../runtimeDeploymentContext';
import { assertNewCheckoutGeography } from './geography';
import { assertCheckoutEnabled, CATALOG_VERSION, configuredTaxCode, OFFERS, PaymentError, priceId, trustedOrigin } from './config';
import { providerRequest, retrieveSession, validCheckoutUrl, validatePrice, validateSession } from './provider';

export function publicOrder(order: PaymentOrder) {
  return {
    id: order.id, offerId: order.offerId, offerName: order.offerName, mode: order.mode,
    currency: order.currency, amountMinor: order.amountMinor, clout: order.clout, status: order.status,
    createdAt: order.createdAt.toISOString(), fulfilledAt: order.fulfilledAt?.toISOString() ?? null,
    refundedAmountMinor: order.refundedAmountMinor,
    taxMode: order.taxMode,
    taxAmountMinor: order.taxAmountMinor ?? (order.taxMode === 'none' ? 0 : null),
    totalAmountMinor: order.totalAmountMinor ?? (order.taxMode === 'none' ? order.amountMinor : null),
    checkoutUrl: order.status === 'pending' && order.expiresAt.getTime() > Date.now() ? order.checkoutUrl : null,
  };
}
export async function getOrder(userId: string, id: string) {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.clerkUserId, userId)));
  if (!order) throw new PaymentError(404, 'Purchase not found.');
  return publicOrder(order);
}
export async function listOrders(userId: string, cursor?: string) {
  const rows = await db.select().from(orders).where(and(eq(orders.clerkUserId, userId), cursor ? lt(orders.id, cursor) : undefined)).orderBy(desc(orders.id)).limit(21);
  return { orders: rows.slice(0, 20).map(publicOrder), nextCursor: rows.length > 20 ? rows[19].id : null };
}
export async function createCheckout(userId: string, input: { offerId: string; idempotencyKey: string; adultConfirmed?: boolean; unitedStatesConfirmed?: boolean }, runtime?: RuntimeDeploymentContext) {
  const mode = assertCheckoutEnabled();
  const offer = OFFERS.find(o => o.id === input.offerId);
  if (!offer) throw new PaymentError(400, 'This bundle is unavailable.');
  const order = await db.transaction(async tx => {
    // Reserve under the profile lock, but never take an order lock in this transaction.
    const [profile] = await tx.select().from(profiles).where(eq(profiles.clerkUserId, userId)).for('update');
    if (!profile || profile.onboardingStep !== 'complete' || !profile.ageConfirmedAt || !profile.termsAcceptedAt) {
      throw new PaymentError(403, 'Complete account eligibility and Rookie Road before purchasing.');
    }
    const [existing] = await tx.select().from(orders).where(and(eq(orders.clerkUserId, userId), eq(orders.idempotencyKey, input.idempotencyKey)));
    if (existing) {
      if (existing.offerId !== input.offerId || existing.mode !== mode) throw new PaymentError(409, 'This request belongs to a different purchase.');
      return existing;
    }
    // Only new reservations require these declarations. Historical retries and
    // settlement retain their original immutable provider parameters.
    if (input.adultConfirmed !== true || input.unitedStatesConfirmed !== true) {
      throw new PaymentError(403, 'Confirm you are at least 18 and located in the United States before starting a new purchase.');
    }
    assertNewCheckoutGeography(runtime);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.clerkUserId, userId), sql`${orders.createdAt} > now() - interval '1 hour'`));
    if (count >= 10) throw new PaymentError(429, 'Too many checkout attempts. Try again later.');
    const id = `${Date.now().toString().padStart(13, '0')}-${randomUUID()}`;
    // Immutable parameters are essential for Stripe's idempotency retries.
    const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 23 * 60 * 60 * 1000);
    const origin = trustedOrigin();
    const selectedPrice = priceId(mode, offer);
    const taxCode = configuredTaxCode(mode);
    const productId = await validatePrice({ mode, priceId: selectedPrice, currency: offer.currency,
      amountMinor: offer.amountMinor, taxMode: 'automatic', taxCode, productId: null });
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment', client_reference_id: id,
      metadata: { orderId: id, userId }, payment_intent_data: { metadata: { orderId: id, userId } },
      line_items: [{ price: selectedPrice, quantity: 1 }], payment_method_types: ['card'],
      automatic_tax: { enabled: true }, billing_address_collection: 'required', allow_promotion_codes: false,
      success_url: `${origin}/game/shop?view=corner&payment=return&order=${id}`,
      cancel_url: `${origin}/game/shop?view=corner&payment=cancel&order=${id}`,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    };
    const [reserved] = await tx.insert(orders).values({
      id, clerkUserId: userId, idempotencyKey: input.idempotencyKey, offerId: offer.id, offerName: offer.name,
      catalogVersion: CATALOG_VERSION, mode, currency: offer.currency, amountMinor: offer.amountMinor, clout: offer.clout,
      priceId: selectedPrice, taxMode: 'automatic', productId, taxCode,
      sessionParams: sessionParams as Record<string, unknown>, expiresAt,
    }).returning();
    return reserved;
  });
  return db.transaction(async tx => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, order.id)).for('update');
    if (current.sessionId || current.status !== 'pending') return { order: publicOrder(current), checkoutUrl: publicOrder(current).checkoutUrl };
    // Never recreate an ambiguous request after provider key eviction. Operations must reconcile it.
    if (current.expiresAt.getTime() <= Date.now() + 31 * 60 * 1000) throw new PaymentError(409, 'This checkout needs payment support reconciliation; do not repeat the payment.');
    await validatePrice(current);
    const session = await providerRequest<Stripe.Checkout.Session>(current.mode, '/v1/checkout/sessions', 'POST', current.sessionParams, `corner:${current.id}`);
    if (session.livemode !== (current.mode === 'live') || !validCheckoutUrl(session.url)) {
      throw new PaymentError(503, 'Stripe checkout could not be verified.');
    }
    const [updated] = await tx.update(orders).set({ sessionId: session.id, checkoutUrl: session.url, updatedAt: new Date() }).where(eq(orders.id, current.id)).returning();
    return { order: publicOrder(updated), checkoutUrl: updated.checkoutUrl };
  });
}

/** Restricted operator entry point; never expose this as a player or public admin route. */
export async function reconcileOrder(orderId: string, event?: { id: string; type: string; sessionId?: string; paymentIntentId?: string; reversed?: 'refunded' | 'disputed' }) {
  let verifiedPaid: { sessionId: string; at: Date } | undefined;
  try {
  return await db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) throw new PaymentError(404, 'Purchase not found.');
    if (event) {
      const [done] = await tx.select().from(events).where(eq(events.id, event.id));
      if (done) return publicOrder(order);
    }
    let sessionId = order.sessionId ?? event?.sessionId;
    if (!sessionId) {
      // Recovery for an ambiguous checkout-create response: provider metadata finds the original session.
      const found = await providerRequest<Stripe.ApiList<Stripe.Checkout.Session>>(order.mode,
        `/v1/checkout/sessions?limit=100&created[gte]=${Math.floor(order.createdAt.getTime() / 1000) - 5}`);
      const matches = found.data.filter(s => s.client_reference_id === order.id && s.metadata?.orderId === order.id);
      if (matches.length !== 1 || found.has_more) throw new PaymentError(409, 'Original checkout requires manual provider lookup.');
      sessionId = matches[0].id;
    }
    const session = await retrieveSession(order.mode, sessionId);
    if (event?.sessionId && event.sessionId !== sessionId) throw new PaymentError(409, 'Payment event session mismatch.');
    const boundOrder = { ...order, sessionId };
    const totals = validateSession(boundOrder, session);
    const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
    if (event?.paymentIntentId && event.paymentIntentId !== (typeof session.payment_intent === 'string' ? session.payment_intent : intent?.id)) {
      throw new PaymentError(409, 'Payment event charge mismatch.');
    }
    const charge = intent && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    if (session.payment_status === 'paid' && (!intent || !charge)) throw new PaymentError(409, 'Paid charge details are not available yet.');
    if (session.payment_status === 'paid' && (
      session.status !== 'complete' || !totals || intent?.status !== 'succeeded' ||
      intent.currency !== order.currency || intent.amount !== totals.totalAmountMinor ||
      intent.amount_received !== totals.totalAmountMinor ||
      charge?.paid !== true || charge.currency !== order.currency || charge.amount !== totals.totalAmountMinor ||
      !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > totals.totalAmountMinor
    )) throw new PaymentError(409, 'The payment charge is not verified.');
    const refundedAmountMinor = Math.max(order.refundedAmountMinor, charge?.amount_refunded ?? 0);
    const disputed = order.disputed || charge?.disputed === true || event?.reversed === 'disputed';
    const reversed = refundedAmountMinor > 0 || event?.reversed === 'refunded' || order.status === 'refunded';
    let status: PaymentOrder['status'] = disputed ? 'disputed' : reversed ? 'refunded' : order.fulfilledAt ? 'fulfilled' :
      session.status === 'expired' ? 'expired' : session.payment_status === 'paid' ? 'processing' :
      event?.type === 'checkout.session.async_payment_failed' ? 'failed' : session.status === 'complete' ? 'processing' : 'pending';
    let fulfilledAt = order.fulfilledAt;
    if (status === 'processing' && session.payment_status === 'paid') {
      verifiedPaid = { sessionId, at: new Date() };
      const [profile] = await tx.select().from(profiles).where(eq(profiles.clerkUserId, order.clerkUserId)).for('update');
      if (!profile) throw new PaymentError(409, 'Payment account requires support.');
      const balance = profile.softCurrency + order.clout;
      if (!Number.isSafeInteger(balance) || balance > 2147483647 || balance < 0) throw new PaymentError(409, 'Wallet limit requires support.');
      const inserted = await tx.insert(fulfillments).values({ orderId: order.id, clout: order.clout }).onConflictDoNothing().returning();
      if (inserted.length) await tx.update(profiles).set({ softCurrency: balance }).where(eq(profiles.clerkUserId, order.clerkUserId));
      fulfilledAt = order.fulfilledAt ?? inserted[0]?.createdAt ?? new Date();
      status = 'fulfilled';
    }
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : intent?.id ?? null;
    const now = new Date();
    const [updated] = await tx.update(orders).set({
      sessionId, paymentIntentId, status, fulfilledAt, refundedAmountMinor, disputed,
      ...(session.payment_status === 'paid' && totals ? totals : {}),
      updatedAt: now,
      paidAt: order.paidAt ?? (session.payment_status === 'paid' ? now : null),
      failedAt: order.failedAt ?? (status === 'failed' ? now : null),
      refundedAt: order.refundedAt ?? (reversed ? now : null),
      disputedAt: order.disputedAt ?? (disputed ? now : null),
    }).where(eq(orders.id, order.id)).returning();
    if (event) await tx.insert(events).values({ id: event.id, orderId: order.id, type: event.type });
    return publicOrder(updated);
  });
  } catch (error) {
    // Publish verified-but-uncredited truth after the failed credit transaction rolls back.
    // The event is deliberately not completed; retries still execute the atomic grant.
    if (verifiedPaid) {
      await db.update(orders).set({
        status: 'processing', sessionId: verifiedPaid.sessionId,
        paidAt: sql`coalesce(${orders.paidAt}, ${verifiedPaid.at})`,
        updatedAt: sql`greatest(${orders.updatedAt}, ${verifiedPaid.at})`,
      }).where(and(eq(orders.id, orderId), isNull(orders.fulfilledAt), inArray(orders.status, ['pending', 'processing'])));
    }
    throw error;
  }
}

export async function processPaymentEvent(event: Stripe.Event) {
  const mode = event.livemode ? 'live' : 'test';
  const object = event.data.object as unknown as { id: string; object: string; metadata?: Record<string, string>; payment_intent?: string };
  const supported = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed',
    'checkout.session.expired', 'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed', 'charge.dispute.updated'];
  if (!supported.includes(event.type)) return;
  let orderId = object.metadata?.orderId;
  if (!orderId && object.payment_intent) {
    const intent = await providerRequest<Stripe.PaymentIntent>(mode, `/v1/payment_intents/${encodeURIComponent(object.payment_intent)}`);
    orderId = intent.metadata.orderId;
  }
  if (!orderId) return; // Other products in the same merchant account are not ours.
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new PaymentError(409, 'Payment order has not been reserved.');
  if (order.mode !== mode) throw new PaymentError(409, 'Payment environment mismatch.');
  await reconcileOrder(orderId, {
    id: event.id, type: event.type, sessionId: object.object === 'checkout.session' ? object.id : undefined,
    paymentIntentId: object.object === 'checkout.session' ? undefined : object.payment_intent,
    reversed: event.type.startsWith('charge.dispute.') ? 'disputed' : event.type === 'charge.refunded' ? 'refunded' : undefined,
  });
}