import Stripe from 'stripe';
import { ReplitConnectors } from '@replit/connectors-sdk';
import type { PaymentOrder } from '@workspace/db';
import { PaymentError, secretKey, type PaymentMode } from './config';

function form(values: unknown, prefix = '', out = new URLSearchParams()): URLSearchParams {
  if (values !== null && typeof values === 'object') {
    for (const [key, value] of Object.entries(values)) form(value, prefix ? `${prefix}[${key}]` : key, out);
  } else if (values !== undefined && values !== null) out.append(prefix, String(values));
  return out;
}
export function proxyAvailable(mode: PaymentMode) {
  return mode === 'test' && process.env.PAYMENTS_REPLIT_TEST_PROXY === 'true' && Boolean(process.env.REPL_IDENTITY) && process.env.NETLIFY !== 'true';
}
export async function providerRequest<T>(mode: PaymentMode, path: string, method: 'GET' | 'POST' = 'GET', data?: unknown, idempotencyKey?: string): Promise<T> {
  if (proxyAvailable(mode)) {
    const connectors = new ReplitConnectors();
    const balance = await connectors.proxy('stripe', '/v1/balance', { method: 'GET' });
    if (!balance.ok || (await balance.json() as { livemode?: boolean }).livemode !== false) {
      throw new PaymentError(503, 'Test payment connection could not be verified.');
    }
    const response = await connectors.proxy('stripe', path, {
      method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      ...(data ? { body: form(data).toString() } : {}),
    });
    if (!response.ok) throw new PaymentError(503, 'Stripe could not confirm this request. Retry the same purchase.');
    return await response.json() as T;
  }
  const stripe = new Stripe(secretKey(mode), { maxNetworkRetries: 2, timeout: 15000 });
  return await stripe.rawRequest(method, path, data as Record<string, unknown> | undefined, idempotencyKey ? { idempotencyKey } : undefined) as T;
}
export async function retrieveSession(mode: PaymentMode, sessionId: string) {
  return providerRequest<Stripe.Checkout.Session>(mode, `/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items&expand[]=payment_intent.latest_charge`);
}
export async function validatePrice(order: Pick<PaymentOrder, 'mode' | 'priceId' | 'currency' | 'amountMinor' | 'taxMode' | 'taxCode' | 'productId'>) {
  const price = await providerRequest<Stripe.Price>(order.mode, `/v1/prices/${encodeURIComponent(order.priceId)}?expand[]=product`);
  if (!price.active || price.livemode !== (order.mode === 'live') || price.currency !== order.currency ||
    price.unit_amount !== order.amountMinor || price.recurring || price.type !== 'one_time' || price.billing_scheme !== 'per_unit') {
    throw new PaymentError(503, 'This Stripe price does not match the approved bundle.');
  }
  if (order.taxMode === 'automatic') {
    const product = typeof price.product === 'object' && !('deleted' in price.product) ? price.product : null;
    const code = product && (typeof product.tax_code === 'string' ? product.tax_code : product.tax_code?.id);
    if (price.tax_behavior !== 'exclusive' || !product?.active || !order.taxCode || code !== order.taxCode ||
      (order.productId && product.id !== order.productId)) {
      throw new PaymentError(503, 'Stripe price requires exclusive tax and the configured product tax classification.');
    }
    return product.id;
  }
  return null;
}
export function validateSession(order: PaymentOrder, session: Stripe.Checkout.Session) {
  const lines = session.line_items?.data;
  if (session.id !== order.sessionId || session.livemode !== (order.mode === 'live') || session.mode !== 'payment' ||
    session.client_reference_id !== order.id || session.metadata?.orderId !== order.id ||
    session.metadata?.userId !== order.clerkUserId || session.currency !== order.currency ||
    session.amount_subtotal !== order.amountMinor ||
    session.total_details?.amount_discount !== 0 || session.total_details.amount_shipping !== 0 ||
    session.line_items?.has_more || lines?.length !== 1 || lines[0].quantity !== 1 ||
    lines[0].price?.id !== order.priceId) {
    throw new PaymentError(409, 'Payment verification did not match the reserved order.');
  }
  const fail = () => { throw new PaymentError(409, 'Payment tax verification did not match the reserved order.'); };
  if (order.taxMode === 'none') {
    if (session.amount_total !== order.amountMinor || session.total_details.amount_tax !== 0 ||
      session.automatic_tax?.enabled || lines[0].amount_total !== order.amountMinor) fail();
    return { taxAmountMinor: 0, totalAmountMinor: order.amountMinor };
  }
  const product = lines[0].price?.product;
  if (order.taxMode !== 'automatic' || !session.automatic_tax?.enabled ||
    (typeof product === 'string' ? product : product?.id) !== order.productId ||
    lines[0].price?.tax_behavior !== 'exclusive' || lines[0].amount_subtotal !== order.amountMinor ||
    lines[0].currency !== order.currency || lines[0].amount_discount !== 0) fail();
  // Open/expired sessions may not have a completed address calculation.
  if (session.payment_status !== 'paid' && session.automatic_tax.status !== 'complete') return null;
  const tax = session.total_details.amount_tax;
  const total = session.amount_total;
  if (session.automatic_tax.status !== 'complete' || !Number.isSafeInteger(tax) || tax < 0 ||
    !Number.isSafeInteger(total) || total! > 2147483647 || total !== order.amountMinor + tax ||
    lines[0].amount_tax !== tax || lines[0].amount_total !== total ||
    (order.totalAmountMinor !== null && order.totalAmountMinor !== total) ||
    (order.taxAmountMinor !== null && order.taxAmountMinor !== tax)) fail();
  return { taxAmountMinor: tax, totalAmountMinor: total! };
}
export function validCheckoutUrl(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.origin === 'https://checkout.stripe.com' &&
      !url.username && !url.password && !url.port && !/^https:\/\/[^/]*:\d+/i.test(raw);
  } catch { return false; }
}
export function verifyWebhook(payload: Buffer, signature: string): Stripe.Event {
  if (!Buffer.isBuffer(payload) || !signature) throw new PaymentError(400, 'A signed raw webhook is required.');
  const timestamps = signature.split(',').filter(part => part.startsWith('t='));
  const timestamp = timestamps.length === 1 ? Number(timestamps[0].slice(2)) : NaN;
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
    throw new PaymentError(400, 'Invalid payment signature timestamp.');
  }
  for (const mode of ['test', 'live'] as const) {
    const secret = process.env[`STRIPE_${mode.toUpperCase()}_WEBHOOK_SECRET`];
    if (!secret) continue;
    try {
      const event = Stripe.webhooks.constructEvent(payload, signature, secret, 300);
      if (event.livemode === (mode === 'live')) return event;
    } catch { /* Try the other environment's signing secret. */ }
  }
  throw new PaymentError(400, 'Invalid payment signature.');
}