import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import Stripe from 'stripe';
import express from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, pool, paymentOrdersTable as orders, paymentEventsTable as events, paymentFulfillmentsTable as fulfillments, playerProfilesTable as profiles } from '@workspace/db';
import { createCheckout, processPaymentEvent, reconcileOrder } from './service';
import { PaymentError } from './config';
import router, { paymentWebhook } from '../../routes/payments';
import { getPlayerBootstrap } from '../playerState';
import { openStreetPackForPlayer } from '../collectionTransactions';
import { webRequestAdapter } from '../webRequestAdapter';
import { runWithDeploymentContext } from '../runtimeDeploymentContext';
import { readFile } from 'node:fs/promises';

// Only the Stripe HTTP transport is replaced. Validation, signatures, routes and transactions are real.
test('additive automatic-tax migration preserves old rows and enforces snapshot shapes', async () => {
  const connection = await pool.connect();
  const schema = `tax_migration_${randomUUID().replaceAll('-', '')}`;
  try {
    await connection.query('BEGIN');
    await connection.query(`CREATE SCHEMA ${schema}`);
    await connection.query(`SET LOCAL search_path TO ${schema}`);
    await connection.query('CREATE TABLE player_profiles (clerk_user_id text PRIMARY KEY)');
    await connection.query(await readFile(new URL('../../../../../netlify/database/migrations/202610010001_corner-payments/migration.sql', import.meta.url), 'utf8'));
    await connection.query("INSERT INTO player_profiles VALUES ('owner')");
    await connection.query(`INSERT INTO payment_orders (id,clerk_user_id,idempotency_key,offer_id,offer_name,catalog_version,mode,currency,amount_minor,clout,price_id,session_params,expires_at)
      VALUES ('legacy','owner','key','clout-pocket','Pocket','corner-clout-v1','test','usd',299,500,'price_old','{"automatic_tax":{"enabled":false}}',now())`);
    await connection.query(await readFile(new URL('../../../../../netlify/database/migrations/202610010002_payment-automatic-tax/migration.sql', import.meta.url), 'utf8'));
    const legacy = (await connection.query('SELECT * FROM payment_orders')).rows[0];
    assert.equal(legacy.tax_mode, 'none');
    assert.equal(legacy.tax_amount_minor, null);
    assert.deepEqual(legacy.session_params, { automatic_tax: { enabled: false } });
    for (const invalid of [
      "tax_amount_minor=1,total_amount_minor=300",
      "tax_mode='automatic'",
      "tax_mode='automatic',product_id='prod',tax_code='txcd',tax_amount_minor=1,total_amount_minor=NULL",
      "tax_mode='automatic',product_id='prod',tax_code='txcd',tax_amount_minor=-1,total_amount_minor=298",
    ]) {
      await connection.query('SAVEPOINT invalid_shape');
      await assert.rejects(connection.query(`UPDATE payment_orders SET ${invalid}`));
      await connection.query('ROLLBACK TO SAVEPOINT invalid_shape');
    }
    await connection.query("UPDATE payment_orders SET tax_mode='automatic',product_id='prod',tax_code='txcd',tax_amount_minor=30,total_amount_minor=329");
  } finally {
    await connection.query('ROLLBACK');
    connection.release();
  }
});

async function fixture(t: TestContext, balance = 1000) {
  assert.equal(process.env.CAMPAIGN_DATABASE_TESTS, '1', 'Use the guarded database runner');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(new URL(process.env.DATABASE_URL!).hostname), 'Payment tests are local-only');
  const env = {
    PAYMENTS_ENABLED: 'true', PAYMENTS_MODE: 'test', PAYMENTS_PUBLIC_ORIGIN: 'https://payments.example.test',
    PAYMENTS_REPLIT_TEST_PROXY: 'false', STRIPE_TEST_SECRET_KEY: 'sk_test_transport_fixture',
    STRIPE_TEST_WEBHOOK_SECRET: 'whsec_transport_fixture', STRIPE_TEST_PRICE_POCKET: 'price_pocket',
    STRIPE_TEST_PRICE_STACK: 'price_stack',
    STRIPE_TEST_TAX_CODE: 'txcd_12345678',
  };
  const before = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const user = `payments-test-${randomUUID()}`;
  await db.insert(profiles).values({ clerkUserId: user, onboardingStep: 'complete', ageConfirmedAt: new Date(), termsAcceptedAt: new Date(), softCurrency: balance });
  t.after(async () => {
    const rows = await db.select().from(orders).where(eq(orders.clerkUserId, user));
    for (const order of rows) {
      await db.delete(events).where(eq(events.orderId, order.id));
      await db.delete(fulfillments).where(eq(fulfillments.orderId, order.id));
    }
    await db.delete(orders).where(eq(orders.clerkUserId, user));
    await db.delete(profiles).where(eq(profiles.clerkUserId, user));
  });
  const sessions = new Map<string, any>();
  const calls: { key: string; data: unknown }[] = [];
  let ambiguous = false;
  t.mock.method(Stripe.prototype, 'rawRequest', async (_method: string, path: string, data: any, options: any) => {
    if (path.startsWith('/v1/prices/')) return { active: true, livemode: false, currency: 'usd', unit_amount: path.includes('price_stack') ? 799 : 299, type: 'one_time', billing_scheme: 'per_unit', tax_behavior: 'exclusive', product: { id: 'prod_fixture', active: true, tax_code: 'txcd_12345678' } };
    if (path === '/v1/checkout/sessions') {
      calls.push({ key: options.idempotencyKey, data: structuredClone(data) });
      const id = `cs_${data.client_reference_id}`;
      if (!sessions.has(id)) sessions.set(id, {
        id, url: 'https://checkout.stripe.com/c/pay/test', livemode: false, mode: 'payment',
        client_reference_id: data.client_reference_id, metadata: data.metadata, currency: 'usd',
        amount_total: 299, amount_subtotal: 299, total_details: { amount_tax: 0, amount_discount: 0, amount_shipping: 0 },
        automatic_tax: { enabled: true, status: 'complete' }, line_items: { has_more: false, data: [{ quantity: 1, price: { id: 'price_pocket', product: 'prod_fixture', tax_behavior: 'exclusive' }, currency: 'usd', amount_subtotal: 299, amount_discount: 0, amount_tax: 0, amount_total: 299 }] },
        status: 'complete', payment_status: 'unpaid', payment_intent: null,
      });
      if (ambiguous) { ambiguous = false; throw new Error('Simulated response lost after provider accepted request'); }
      return sessions.get(id);
    }
    if (path.startsWith('/v1/checkout/sessions?')) return { data: [...sessions.values()], has_more: false };
    if (path.startsWith('/v1/checkout/sessions/')) return sessions.get(path.split('/').pop()!.split('?')[0]);
    throw new Error(`Unexpected Stripe transport endpoint: ${path}`);
  });
  const checkout = (key = randomUUID()) => createCheckout(user, { offerId: 'clout-pocket', idempotencyKey: key, adultConfirmed: true, unitedStatesConfirmed: true });
  const session = (id: string) => sessions.get(`cs_${id}`);
  const paid = (id: string) => Object.assign(session(id), {
    payment_status: 'paid', payment_intent: { id: `pi_${id}`, status: 'succeeded', currency: 'usd', amount: session(id).amount_total, amount_received: session(id).amount_total, latest_charge: { paid: true, currency: 'usd', amount: session(id).amount_total, amount_refunded: 0, disputed: false } },
  });
  const event = (id: string, type = 'checkout.session.completed', eventId = `evt_${randomUUID()}`) => ({
    id: eventId, type, livemode: false, data: { object: { id: `cs_${id}`, object: 'checkout.session', metadata: { orderId: id } } },
  }) as unknown as Stripe.Event;
  const wallet = async () => (await db.select().from(profiles).where(eq(profiles.clerkUserId, user)))[0].softCurrency;
  return { user, checkout, session, paid, event, wallet, calls, loseResponse: () => { ambiguous = true; } };
}

test('checkout retries preserve the quote/provider key after an ambiguous response; key reuse cannot change offers', async t => {
  const f = await fixture(t);
  const key = randomUUID();
  f.loseResponse();
  await assert.rejects(f.checkout(key), /response lost/);
  const first = await f.checkout(key);
  const retry = await f.checkout(key);
  assert.equal(first.order.id, retry.order.id);
  assert.deepEqual(f.calls[0], f.calls[1]);
  assert.equal(f.calls.length, 2);
  await assert.rejects(createCheckout(f.user, { offerId: 'clout-stack', idempotencyKey: key }), (e: unknown) => e instanceof PaymentError && e.status === 409);
  assert.equal(await f.wallet(), 1000);
});

test('age, terms and onboarding are independently required before reservation', async t => {
  const f = await fixture(t);
  for (const change of [{ ageConfirmedAt: null }, { termsAcceptedAt: null }, { onboardingStep: 'starter' }]) {
    await db.update(profiles).set({ ageConfirmedAt: new Date(), termsAcceptedAt: new Date(), onboardingStep: 'complete', ...change }).where(eq(profiles.clerkUserId, f.user));
    await assert.rejects(f.checkout(), (e: unknown) => e instanceof PaymentError && e.status === 403);
  }
  assert.equal((await db.select().from(orders).where(eq(orders.clerkUserId, f.user))).length, 0);
  assert.equal(f.calls.length, 0);
});

test('automatic tax totals are verified atomically, immutable, and used for refunds', async t => {
  const f = await fixture(t);
  const { order } = await f.checkout();
  assert.equal(order.taxMode, 'automatic');
  assert.equal(order.totalAmountMinor, null);
  const session = f.session(order.id);
  session.amount_total = 329;
  session.total_details.amount_tax = 30;
  session.line_items.data[0].amount_tax = 30;
  session.line_items.data[0].amount_total = 329;
  f.paid(order.id);
  const event = f.event(order.id);
  const constraint = `tax_rollback_${randomUUID().replaceAll('-', '')}`;
  await db.execute(sql.raw(`ALTER TABLE payment_events ADD CONSTRAINT "${constraint}" CHECK (id <> '${event.id}')`));
  await assert.rejects(processPaymentEvent(event));
  assert.equal(await f.wallet(), 1000);
  assert.equal((await db.select().from(orders).where(eq(orders.id, order.id)))[0].totalAmountMinor, null);
  await db.execute(sql.raw(`ALTER TABLE payment_events DROP CONSTRAINT "${constraint}"`));
  await processPaymentEvent(event);
  await processPaymentEvent(event);
  assert.equal(await f.wallet(), 1500);
  const settled = await reconcileOrder(order.id);
  assert.equal(settled.amountMinor, 299);
  assert.equal(settled.taxAmountMinor, 30);
  assert.equal(settled.totalAmountMinor, 329);
  session.payment_intent.latest_charge.amount_refunded = 329;
  const refunded = await reconcileOrder(order.id);
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.refundedAmountMinor, 329);
  assert.equal(refunded.totalAmountMinor, 329);
  assert.equal(await f.wallet(), 1500);
});

test('tax verification rejects incomplete calculations and amount/product/intent tampering before credit', async t => {
  const f = await fixture(t);
  const { order } = await f.checkout();
  f.paid(order.id);
  const baseline = structuredClone(f.session(order.id));
  const mutations = [
    (s: any) => { s.automatic_tax.status = 'requires_location_inputs'; },
    (s: any) => { s.total_details.amount_tax = -1; },
    (s: any) => { s.total_details.amount_tax = 0.5; },
    (s: any) => { s.amount_total = 330; },
    (s: any) => { s.line_items.data[0].price.product = 'prod_other'; },
    (s: any) => { s.line_items.data[0].price.tax_behavior = 'inclusive'; },
    (s: any) => { s.total_details.amount_shipping = 1; },
    (s: any) => { s.total_details.amount_discount = 1; },
    (s: any) => { s.payment_intent.amount = 300; },
    (s: any) => { s.payment_intent.amount_received = 300; },
    (s: any) => { s.payment_intent.latest_charge.amount = 300; },
  ];
  for (const mutate of mutations) {
    Object.assign(f.session(order.id), structuredClone(baseline));
    mutate(f.session(order.id));
    await assert.rejects(processPaymentEvent(f.event(order.id)));
    assert.equal(await f.wallet(), 1000);
  }
  Object.assign(f.session(order.id), baseline);
  await processPaymentEvent(f.event(order.id));
  const settled = await reconcileOrder(order.id);
  assert.equal(settled.taxAmountMinor, 0);
  assert.equal(settled.totalAmountMinor, 299);
});

test('historical no-tax reservation retries keep exact params and settle without tax configuration', async t => {
  const f = await fixture(t);
  const key = randomUUID();
  const created = await f.checkout(key);
  const [record] = await db.select().from(orders).where(eq(orders.id, created.order.id));
  const legacy = { ...record.sessionParams, automatic_tax: { enabled: false } };
  delete (legacy as Record<string, unknown>).billing_address_collection;
  await db.update(orders).set({ catalogVersion: 'corner-clout-v1', taxMode: 'none', productId: null, taxCode: null,
    sessionParams: legacy, sessionId: null, checkoutUrl: null }).where(eq(orders.id, record.id));
  delete process.env.STRIPE_TEST_TAX_CODE;
  const retried = await f.checkout(key);
  assert.equal(retried.order.id, record.id);
  assert.deepEqual(f.calls.at(-1)!.data, legacy);
  f.session(record.id).automatic_tax = { enabled: false };
  f.paid(record.id);
  await processPaymentEvent(f.event(record.id));
  const settled = await reconcileOrder(record.id);
  assert.equal(settled.taxMode, 'none');
  assert.equal(settled.totalAmountMinor, 299);
  assert.equal(settled.taxAmountMinor, 0);
  await assert.rejects(f.checkout(), /classification/);
});

test('concurrent checkout requests reserve one order and create one provider session', async t => {
  const f = await fixture(t);
  const key = randomUUID();
  const results = await Promise.all(Array.from({ length: 5 }, () => f.checkout(key)));
  assert.equal(new Set(results.map(result => result.order.id)).size, 1);
  assert.equal(f.calls.length, 1);
  assert.equal((await db.select().from(orders).where(eq(orders.clerkUserId, f.user))).length, 1);
});

test('tampered provider settlement cannot consume an event or credit a wallet', async t => {
  const f = await fixture(t);
  const { order } = await f.checkout();
  f.paid(order.id);
  const session = f.session(order.id);
  const original = structuredClone(session);
  const event = f.event(order.id);
  for (const change of [
    { metadata: { orderId: order.id, userId: 'another-owner' } },
    { amount_total: 1 }, { currency: 'eur' }, { livemode: true },
    { line_items: { has_more: false, data: [{ quantity: 2, price: { id: 'price_pocket' }, amount_total: 299 }] } },
  ]) {
    Object.assign(session, structuredClone(original), change);
    await assert.rejects(processPaymentEvent(event), /verification/);
    assert.equal(await f.wallet(), 1000);
    assert.equal((await db.select().from(events).where(eq(events.id, event.id))).length, 0);
  }
  Object.assign(session, original);
  await processPaymentEvent(event);
  assert.equal(await f.wallet(), 1500);
});

test('an event identity already used for another order cannot credit a second order', async t => {
  const f = await fixture(t);
  const first = await f.checkout();
  const second = await f.checkout();
  const conflictingId = `evt_${randomUUID()}`;
  await processPaymentEvent(f.event(first.order.id, 'checkout.session.completed', conflictingId));
  f.paid(second.order.id);
  // A reused event identity is already consumed, so it must never credit another order.
  await processPaymentEvent(f.event(second.order.id, 'checkout.session.completed', conflictingId));
  assert.equal(await f.wallet(), 1000);
  assert.equal((await db.select().from(fulfillments).where(eq(fulfillments.orderId, second.order.id))).length, 0);
  const event = f.event(second.order.id);
  await processPaymentEvent(event);
  assert.equal(await f.wallet(), 1500);
});

test('late database event write failure rolls back wallet and ledger and remains retryable', async t => {
  const f = await fixture(t);
  const { order } = await f.checkout();
  f.paid(order.id);
  const event = f.event(order.id);
  const constraint = `payment_test_${randomUUID().replaceAll('-', '')}`;
  // Test-only constraint rejects exactly this synthetic event, after the wallet/ledger writes.
  await db.execute(sql.raw(`ALTER TABLE payment_events ADD CONSTRAINT "${constraint}" CHECK (id <> '${event.id}')`));
  try {
    await assert.rejects(processPaymentEvent(event));
    assert.equal(await f.wallet(), 1000);
    assert.equal((await db.select().from(fulfillments).where(eq(fulfillments.orderId, order.id))).length, 0);
    assert.equal((await db.select().from(events).where(eq(events.id, event.id))).length, 0);
  } finally {
    await db.execute(sql.raw(`ALTER TABLE payment_events DROP CONSTRAINT "${constraint}"`));
  }
  await processPaymentEvent(event);
  assert.equal(await f.wallet(), 1500);
  assert.equal((await db.select().from(fulfillments).where(eq(fulfillments.orderId, order.id))).length, 1);
});

test('unpaid completion never grants; duplicate and reordered events grant once, including with checkout disabled', async t => {
  const f = await fixture(t);
  const { order } = await f.checkout();
  await processPaymentEvent(f.event(order.id));
  assert.equal(await f.wallet(), 1000);
  f.paid(order.id);
  process.env.PAYMENTS_ENABLED = 'false';
  const event = f.event(order.id);
  await Promise.all([processPaymentEvent(event), processPaymentEvent(event), processPaymentEvent(f.event(order.id))]);
  // The retrieved session remains paid even when a stale expiry event arrives.
  await processPaymentEvent(f.event(order.id, 'checkout.session.expired'));
  await processPaymentEvent(f.event(order.id, 'checkout.session.async_payment_failed'));
  assert.equal(await f.wallet(), 1500);
  assert.equal((await db.select().from(fulfillments).where(eq(fulfillments.orderId, order.id))).length, 1);
  assert.equal((await reconcileOrder(order.id)).status, 'fulfilled');
});

test('refund/dispute before and after payment are sticky and never regrant', async t => {
  const f = await fixture(t);
  let expected = 1000;
  for (const reversed of ['refunded', 'disputed'] as const) {
    for (const beforePaid of [true, false]) {
      const { order } = await f.checkout();
      if (!beforePaid) { f.paid(order.id); await reconcileOrder(order.id); expected += 500; }
      else f.session(order.id).payment_intent = { id: `pi_${order.id}`, status: 'processing', latest_charge: null };
      await processPaymentEvent({
        id: `evt_${randomUUID()}`, livemode: false,
        type: reversed === 'refunded' ? 'charge.refunded' : 'charge.dispute.created',
        data: { object: { id: `ch_${order.id}`, object: reversed === 'refunded' ? 'charge' : 'dispute',
          metadata: { orderId: order.id }, payment_intent: `pi_${order.id}` } },
      } as unknown as Stripe.Event);
      f.paid(order.id);
      await processPaymentEvent(f.event(order.id));
      await processPaymentEvent(f.event(order.id));
      assert.equal((await reconcileOrder(order.id)).status, reversed);
      assert.equal(await f.wallet(), expected);
      assert.equal((await db.select().from(fulfillments).where(eq(fulfillments.orderId, order.id))).length, beforePaid ? 0 : 1);
    }
  }
});

test('verification failure and wallet overflow roll back the event and fulfillment, allowing exact event retry', async t => {
  const f = await fixture(t, 2147483647);
  const { order } = await f.checkout();
  const event = f.event(order.id);
  f.paid(order.id);
  for (const badCharge of [true, false]) {
    f.session(order.id).payment_intent.latest_charge.amount = badCharge ? 1 : 299;
    await assert.rejects(processPaymentEvent(event), /verified|Wallet limit/);
    assert.equal((await db.select().from(events).where(eq(events.id, event.id))).length, 0);
    assert.equal((await db.select().from(fulfillments).where(eq(fulfillments.orderId, order.id))).length, 0);
    assert.equal((await db.select().from(orders).where(eq(orders.id, order.id)))[0].status, badCharge ? 'pending' : 'processing');
    assert.equal(await f.wallet(), 2147483647);
  }
  await db.update(profiles).set({ softCurrency: 0 }).where(eq(profiles.clerkUserId, f.user));
  await processPaymentEvent(event);
  assert.equal(await f.wallet(), 500);
});

test('ambiguous reservation can settle through provider lookup without recreating checkout', async t => {
  const f = await fixture(t);
  f.loseResponse();
  await assert.rejects(f.checkout(), /response lost/);
  const [order] = await db.select().from(orders).where(eq(orders.clerkUserId, f.user));
  f.paid(order.id);
  assert.equal((await reconcileOrder(order.id)).status, 'fulfilled');
  assert.equal(f.calls.length, 1);
  assert.equal(await f.wallet(), 1500);
});

test('payment, bootstrap normalization and pack earn/spend retain all wallet updates', async t => {
  const f = await fixture(t);
  const { order } = await f.checkout();
  f.paid(order.id);
  // Independent backend PIDs establish whether this run can exercise PostgreSQL row locks.
  if (process.env.PAYMENT_REQUIRE_POSTGRES === '1') {
    const a = await pool.connect();
    const b = await pool.connect();
    try { assert.notEqual((await a.query('select pg_backend_pid() pid')).rows[0].pid, (await b.query('select pg_backend_pid() pid')).rows[0].pid); }
    finally { a.release(); b.release(); }
  } else t.diagnostic('No independent-connection requirement: PGlite execution is functional coverage, not a lock proof.');
  const [, , pack] = await Promise.all([
    processPaymentEvent(f.event(order.id)),
    getPlayerBootstrap(f.user),
    openStreetPackForPlayer(f.user, { idempotencyKey: randomUUID(), paymentMethod: 'softCurrency' }),
  ]);
  const earned = pack.opening.rewards.filter(reward => reward.kind === 'softCurrency').reduce((sum, reward) => sum + reward.amount, 0);
  assert.equal(await f.wallet(), 1000 + 500 - pack.opening.cost + earned);
  // Force an overlapping holder of the SAME row; settlement must remain blocked until commit.
  if (process.env.PAYMENT_REQUIRE_POSTGRES === '1') {
    const second = await f.checkout();
    f.paid(second.order.id);
    const client = await pool.connect();
    let finished = false;
    let settling: Promise<unknown> | undefined;
    try {
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM player_profiles WHERE clerk_user_id=$1 FOR UPDATE', [f.user]);
      settling = processPaymentEvent(f.event(second.order.id)).then(() => { finished = true; });
      // Poll pg_stat_activity instead of treating a sleep as proof of blocking.
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await db.execute(sql`select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%player_profiles%'`);
        if (result.rows.length) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(blocked, true, 'settlement must wait on the locked profile');
      assert.equal(finished, false);
      await client.query('UPDATE player_profiles SET soft_currency=soft_currency+17 WHERE clerk_user_id=$1', [f.user]);
      await client.query('COMMIT');
      await settling;
      assert.equal(await f.wallet(), 1000 + 1000 - pack.opening.cost + earned + 17);
    } finally { await client.query('ROLLBACK'); client.release(); await settling; }
  }
});

test('Express routes enforce auth, strict bodies, owner isolation and signed raw webhook settlement', async t => {
  const f = await fixture(t);
  const app = express();
  app.use((req, _res, next) => {
    const userId = req.header('x-test-user') || null;
    Object.assign(req, { auth: Object.assign(() => ({ userId, sessionId: userId ? 'test' : null, tokenType: 'session_token' }), { [Symbol.for('@clerk/express.auth')]: true }), log: { error() {} } });
    next();
  });
  app.post('/payments/webhook', express.raw({ type: 'application/json' }), paymentWebhook);
  app.use(express.json(), router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = (path: string, user = f.user, body?: unknown) => fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-test-user': user }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal((await request('/player/payments/catalog', '')).status, 401);
  assert.equal((await request('/player/payments/checkout', '', {})).status, 401);
  for (const extra of [{ amountMinor: 1 }, { clout: 99999 }, { userId: 'victim' }, { priceId: 'price_attacker' }, { success_url: 'https://evil.test' }]) {
    assert.equal((await request('/player/payments/checkout', f.user, { offerId: 'clout-pocket', idempotencyKey: randomUUID(), ...extra })).status, 400);
  }
  const key = randomUUID();
  for (const declarations of [{}, { adultConfirmed: true }, { unitedStatesConfirmed: true }, { adultConfirmed: false, unitedStatesConfirmed: true }]) {
    assert.equal((await request('/player/payments/checkout', f.user, { offerId: 'clout-pocket', idempotencyKey: key, ...declarations })).status, 403);
  }
  const response = await request('/player/payments/checkout', f.user, { offerId: 'clout-pocket', idempotencyKey: key, adultConfirmed: true, unitedStatesConfirmed: true });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { order } = await response.json() as { order: { id: string } };
  const oldAppEnv = process.env.APP_ENV;
  process.env.APP_ENV = 'production';
  t.after(() => { if (oldAppEnv === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = oldAppEnv; });
  const admission = webRequestAdapter(app);
  const newRequest = () => new Request(origin + '/player/payments/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': f.user,
      'x-country': 'US', 'x-nf-geo': JSON.stringify({ country: { code: 'US' } }), 'x-country-code': 'US' },
    body: JSON.stringify({ offerId: 'clout-pocket', idempotencyKey: randomUUID(), adultConfirmed: true, unitedStatesConfirmed: true }),
  });
  assert.equal((await admission(newRequest())).status, 403);
  for (const countryCode of [undefined, 'CA', 'US']) {
    const admitted = await runWithDeploymentContext({
      context: 'production', deployId: 'test-deploy', origin, countryCode,
    }, () => admission(newRequest()));
    assert.equal(admitted.status, countryCode === 'US' ? 200 : 403);
  }
  const retry = await request('/player/payments/checkout', f.user, { offerId: 'clout-pocket', idempotencyKey: key });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json() as { order: { id: string } }).order.id, order.id);
  assert.equal((await request(`/player/payments/orders/${order.id}`, 'other-owner')).status, 404);
  assert.deepEqual((await (await request('/player/payments/orders', 'other-owner')).json() as { orders: unknown[] }).orders, []);
  assert.equal((await request(`/player/payments/orders/${order.id}`, '')).status, 401);
  const own = await (await request(`/player/payments/orders/${order.id}`)).json() as Record<string, unknown>;
  for (const privateKey of ['sessionId', 'paymentIntentId', 'sessionParams', 'clerkUserId', 'idempotencyKey', 'priceId']) assert.equal(privateKey in own, false);
  f.paid(order.id);
  const payload = JSON.stringify(f.event(order.id));
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_TEST_WEBHOOK_SECRET! });
  const webhook = (body: string) => fetch(origin + '/payments/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body });
  assert.equal((await webhook(payload + ' ')).status, 400);
  assert.equal(await f.wallet(), 1000);
  assert.equal((await webhook(payload)).status, 200);
  assert.equal((await webhook(payload)).status, 200);
  const handle = webRequestAdapter(app);
  const adapted = await handle(new Request(origin + '/payments/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload }));
  assert.equal(adapted.status, 200);
  assert.equal((await handle(new Request(origin + '/player/payments/orders'))).status, 401);
  assert.equal((await handle(new Request(origin + `/player/payments/orders/${order.id}`, { headers: { 'x-test-user': 'other-owner' } }))).status, 404);
  assert.equal(await f.wallet(), 1500);
});