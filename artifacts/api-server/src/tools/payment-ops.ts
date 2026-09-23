import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, paymentOrdersTable as orders } from '@workspace/db';
import type Stripe from 'stripe';
import { CATALOG_VERSION, configuredTaxCode, OFFERS, PaymentError } from '../lib/payments/config';
import { providerRequest } from '../lib/payments/provider';
import { reconcileOrder } from '../lib/payments/service';

type Command = 'diagnostic' | 'reconcile' | 'seed-test-catalog';

class OperatorInputError extends Error {}

function fail(message: string): never {
  throw new OperatorInputError(message);
}

function parseArguments(argv: string[]) {
  const command = argv[0] as Command | undefined;
  if (!command || !['diagnostic', 'reconcile', 'seed-test-catalog'].includes(command)) {
    fail('Usage: payment-ops <diagnostic|reconcile|seed-test-catalog> [--order ID] [--apply] --confirm TOKEN');
  }
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') flags.add(argument);
    else if (argument === '--order' || argument === '--confirm') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) fail(`${argument} requires a value.`);
      values.set(argument, value);
    } else fail(`Unknown argument: ${argument}`);
  }
  return { command, apply: flags.has('--apply'), orderId: values.get('--order'), confirmation: values.get('--confirm') };
}

function databaseTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) fail('DATABASE_URL is required.');
  const url = new URL(raw);
  const database = url.pathname.replace(/^\//, '');
  if (!database) fail('DATABASE_URL must name a database.');
  const fingerprint = createHash('sha256').update([
    `${decodeURIComponent(url.username).toLowerCase()}@${url.hostname.toLowerCase()}:${url.port || '5432'}/${decodeURIComponent(database)}`,
    ...['schema', 'search_path', 'options'].filter(name => url.searchParams.has(name)).map(name => `${name}=${url.searchParams.get(name)}`),
  ].join('|')).digest('hex').slice(0, 16);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname.toLowerCase());
  const environment = local ? 'local' : process.env.APP_ENV;
  if (!local && !['staging', 'production'].includes(environment ?? '')) {
    fail('Remote payment operations require APP_ENV=staging or APP_ENV=production.');
  }
  if (!local && process.env.PAYMENT_OPS_DATABASE_FINGERPRINT !== fingerprint) {
    fail('PAYMENT_OPS_DATABASE_FINGERPRINT does not match the selected database.');
  }
  if (environment === 'production') {
    const deployId = process.env.DEPLOY_ID;
    const origin = process.env.PAYMENTS_PUBLIC_ORIGIN;
    if (!deployId || !origin) fail('Production operations require DEPLOY_ID and PAYMENTS_PUBLIC_ORIGIN.');
    const expected = `production:${fingerprint}:${deployId}:${new URL(origin).hostname}`;
    if (process.env.PAYMENT_OPS_PRODUCTION_CONFIRM !== expected) {
      fail('Production authorization does not match the database, deployment, and origin.');
    }
  }
  return { environment: environment as 'local' | 'staging' | 'production', fingerprint };
}

function assertConfirmation(actual: string | undefined, expected: string) {
  if (actual !== expected) fail(`Target confirmation is required. Re-run with --confirm ${expected}`);
}

function minimalOrder(order: typeof orders.$inferSelect) {
  return {
    id: order.id,
    mode: order.mode,
    offerId: order.offerId,
    status: order.status,
    currency: order.currency,
    amountMinor: order.amountMinor,
    taxMode: order.taxMode, taxAmountMinor: order.taxAmountMinor, totalAmountMinor: order.totalAmountMinor,
    clout: order.clout,
    refundedAmountMinor: order.refundedAmountMinor,
    disputed: order.disputed,
    createdAt: order.createdAt.toISOString(),
    fulfilledAt: order.fulfilledAt?.toISOString() ?? null,
  };
}

async function diagnostic(orderId?: string) {
  if (orderId) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) fail('Purchase not found.');
    console.log(JSON.stringify(minimalOrder(order), null, 2));
    return;
  }
  const result = await db.select({
    mode: orders.mode,
    status: orders.status,
    count: sql<number>`count(*)::int`,
  }).from(orders).groupBy(orders.mode, orders.status).orderBy(orders.mode, orders.status);
  console.log(JSON.stringify({ orders: result }, null, 2));
}

async function findOrCreateProduct(offer: typeof OFFERS[number]) {
  const response = await providerRequest<Stripe.ApiList<Stripe.Product>>('test', '/v1/products?limit=100');
  if (response.has_more) fail('The Stripe product list is too large for safe automatic seeding.');
  const matches = response.data.filter(product =>
    product.metadata.corner_catalog_version === CATALOG_VERSION && product.metadata.corner_offer_id === offer.id);
  if (matches.length > 1) fail(`Duplicate Stripe products exist for ${offer.id}; resolve them manually.`);
  if (matches[0] && !matches[0].active) fail(`The tagged Stripe product for ${offer.id} is inactive; resolve it manually.`);
  if (matches[0]) {
    const code = matches[0].tax_code;
    if ((typeof code === 'string' ? code : code?.id) !== configuredTaxCode('test')) fail('Existing product tax classification does not match configuration.');
    return matches[0];
  }
  return providerRequest<Stripe.Product>('test', '/v1/products', 'POST', {
    name: `${offer.name} — ${offer.clout} Clout`,
    tax_code: configuredTaxCode('test'),
    metadata: { corner_catalog_version: CATALOG_VERSION, corner_offer_id: offer.id },
  }, `corner:${CATALOG_VERSION}:product:${offer.id}`);
}

async function findOrCreatePrice(product: Stripe.Product, offer: typeof OFFERS[number]) {
  const response = await providerRequest<Stripe.ApiList<Stripe.Price>>('test',
    `/v1/prices?product=${encodeURIComponent(product.id)}&type=one_time&limit=100`);
  if (response.has_more) fail(`The Stripe price list for ${offer.id} is too large for safe automatic seeding.`);
  const tagged = response.data.filter(price =>
    price.metadata.corner_catalog_version === CATALOG_VERSION && price.metadata.corner_offer_id === offer.id);
  const exact = tagged.filter(price => price.currency === offer.currency && price.unit_amount === offer.amountMinor &&
    price.active && !price.recurring && price.billing_scheme === 'per_unit' && price.tax_behavior === 'exclusive');
  if (tagged.length && exact.length !== 1) fail(`Existing tagged Stripe prices for ${offer.id} do not exactly match the test proposal.`);
  if (exact.length > 1) fail(`Duplicate active Stripe prices exist for ${offer.id}; resolve them manually.`);
  if (exact[0]) return exact[0];
  return providerRequest<Stripe.Price>('test', '/v1/prices', 'POST', {
    product: product.id, tax_behavior: 'exclusive',
    currency: offer.currency,
    unit_amount: offer.amountMinor,
    metadata: { corner_catalog_version: CATALOG_VERSION, corner_offer_id: offer.id },
  }, `corner:${CATALOG_VERSION}:price:${offer.id}:${offer.currency}:${offer.amountMinor}`);
}

async function seedTestCatalog() {
  if (process.env.PAYMENTS_MODE !== 'test') fail('Catalog seeding requires PAYMENTS_MODE=test explicitly.');
  configuredTaxCode('test');
  const mappings: Record<string, string> = {};
  for (const offer of OFFERS) {
    const product = await findOrCreateProduct(offer);
    const price = await findOrCreatePrice(product, offer);
    if (price.livemode || product.livemode) fail('Stripe returned a live-mode catalog object; no mappings were accepted.');
    mappings[`STRIPE_TEST_PRICE_${offer.env}`] = price.id;
  }
  console.log(JSON.stringify({ catalogVersion: CATALOG_VERSION, mappings }, null, 2));
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.command === 'seed-test-catalog') {
    if (!args.apply) fail('Seeding writes to Stripe test mode and requires --apply.');
    assertConfirmation(args.confirmation, `test:${CATALOG_VERSION}`);
    await seedTestCatalog();
    return;
  }
  const target = databaseTarget();
  assertConfirmation(args.confirmation, `${target.environment}:${target.fingerprint}`);
  if (args.command === 'diagnostic') {
    if (args.apply) fail('Diagnostic mode is read-only and does not accept --apply.');
    await diagnostic(args.orderId);
    return;
  }
  if (!args.apply || !args.orderId) fail('Reconciliation requires both --apply and --order ID.');
  await reconcileOrder(args.orderId);
  const [order] = await db.select().from(orders).where(eq(orders.id, args.orderId)).limit(1);
  if (!order) fail('Reconciled purchase could not be read.');
  console.log(JSON.stringify(minimalOrder(order), null, 2));
}

main().catch(error => {
  const message = error instanceof OperatorInputError || error instanceof PaymentError
    ? error.message
    : 'Payment operation failed. Inspect restricted server diagnostics; provider details were suppressed.';
  console.error(message);
  process.exitCode = 1;
});