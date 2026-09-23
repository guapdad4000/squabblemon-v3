import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { verifyWebhook, validateSession, validCheckoutUrl, validatePrice } from './provider';
import { assertCheckoutEnabled, LIVE_APPROVAL, OFFERS, secretKey } from './config';
import type { PaymentOrder } from '@workspace/db';

test('provider credentials accept matching secret/restricted keys and reject wrong mode or malformed keys', () => {
  for (const mode of ['test', 'live'] as const) {
    const name = `STRIPE_${mode.toUpperCase()}_SECRET_KEY`;
    const previous = process.env[name];
    try {
      for (const kind of ['sk', 'rk']) {
        process.env[name] = `${kind}_${mode}_unit_fixture`;
        assert.equal(secretKey(mode), `${kind}_${mode}_unit_fixture`);
      }
      for (const key of [undefined, '', `sk_${mode}_`, `rk_${mode}_`,
        `sk_${mode}_ space`, `rk_${mode}_fixture\n`, `pk_${mode}_fixture`,
        `sk_${mode === 'test' ? 'live' : 'test'}_fixture`,
        `rk_${mode === 'test' ? 'live' : 'test'}_fixture`]) {
        if (key === undefined) delete process.env[name]; else process.env[name] = key;
        assert.throws(() => secretKey(mode), /Payment provider credentials are unavailable/);
      }
    } finally {
      if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
    }
  }
});

test('automatic prices require explicit exclusive tax and exact configured product classification', async t => {
  const previous = { proxy: process.env.PAYMENTS_REPLIT_TEST_PROXY, key: process.env.STRIPE_TEST_SECRET_KEY };
  process.env.PAYMENTS_REPLIT_TEST_PROXY = 'false';
  process.env.STRIPE_TEST_SECRET_KEY = 'sk_test_fixture';
  t.after(() => {
    if (previous.proxy === undefined) delete process.env.PAYMENTS_REPLIT_TEST_PROXY; else process.env.PAYMENTS_REPLIT_TEST_PROXY = previous.proxy;
    if (previous.key === undefined) delete process.env.STRIPE_TEST_SECRET_KEY; else process.env.STRIPE_TEST_SECRET_KEY = previous.key;
  });
  const baseline = { active: true, livemode: false, currency: 'usd', unit_amount: 299, type: 'one_time', billing_scheme: 'per_unit',
    tax_behavior: 'exclusive', product: { id: 'prod_fixture', active: true, tax_code: 'txcd_12345678' } };
  let price: any = baseline;
  t.mock.method(Stripe.prototype, 'rawRequest', async () => price);
  const order = { mode: 'test' as const, priceId: 'price_fixture', currency: 'usd', amountMinor: 299,
    taxMode: 'automatic' as const, taxCode: 'txcd_12345678', productId: 'prod_fixture' };
  assert.equal(await validatePrice(order), 'prod_fixture');
  for (const change of [{ tax_behavior: 'inclusive' }, { tax_behavior: 'unspecified' },
    { product: { ...baseline.product, tax_code: null } }, { product: { ...baseline.product, tax_code: 'txcd_99999999' } },
    { product: { ...baseline.product, id: 'prod_other' } }, { recurring: { interval: 'month' } }, { unit_amount: 300 }]) {
    price = { ...baseline, ...change };
    await assert.rejects(validatePrice(order));
  }
});

test('approved catalog uses integer USD amounts and no live approval', () => {
  assert.deepEqual(OFFERS.map(o => [o.clout, o.amountMinor, o.currency]), [[500, 299, 'usd'], [1500, 799, 'usd'], [4000, 1999, 'usd']]);
  assert.equal(LIVE_APPROVAL.approved, false);
  const old = { mode: process.env.PAYMENTS_MODE, enabled: process.env.PAYMENTS_ENABLED };
  try {
    process.env.PAYMENTS_MODE = 'live';
    process.env.PAYMENTS_ENABLED = 'true';
    assert.throws(assertCheckoutEnabled, /approval/);
  } finally {
    if (old.mode === undefined) delete process.env.PAYMENTS_MODE; else process.env.PAYMENTS_MODE = old.mode;
    if (old.enabled === undefined) delete process.env.PAYMENTS_ENABLED; else process.env.PAYMENTS_ENABLED = old.enabled;
  }
});
test('raw signature verification rejects tampered, stale, wrong mode and parsed payloads', () => {
  const old = process.env.STRIPE_TEST_WEBHOOK_SECRET;
  process.env.STRIPE_TEST_WEBHOOK_SECRET = 'whsec_unit_test_only';
  try {
    const payload = JSON.stringify({ id: 'evt_test', livemode: false, type: 'checkout.session.completed', data: { object: {} } });
    const sign = (body: string, timestamp = Math.floor(Date.now() / 1000)) =>
      Stripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_unit_test_only', timestamp });
    assert.equal(verifyWebhook(Buffer.from(payload), sign(payload)).id, 'evt_test');
    assert.throws(() => verifyWebhook(Buffer.from(payload + ' '), sign(payload)), /signature/);
    assert.throws(() => verifyWebhook(Buffer.from(payload), sign(payload, 1)), /signature/);
    assert.throws(() => verifyWebhook(Buffer.from(payload), sign(payload, Math.floor(Date.now() / 1000) + 301)), /signature/);
    const live = payload.replace('"livemode":false', '"livemode":true');
    assert.throws(() => verifyWebhook(Buffer.from(live), sign(live)), /signature/);
    assert.throws(() => verifyWebhook({} as Buffer, sign(payload)), /raw/);
  } finally {
    if (old === undefined) delete process.env.STRIPE_TEST_WEBHOOK_SECRET; else process.env.STRIPE_TEST_WEBHOOK_SECRET = old;
  }
});
test('settlement must match mode, immutable quote, owner, quantity and no tax', () => {
  const order = { id: 'order', sessionId: 'cs_test', mode: 'test', clerkUserId: 'owner', currency: 'usd', amountMinor: 299, priceId: 'price_test', taxMode: 'none' } as PaymentOrder;
  const session = {
    id: 'cs_test', livemode: false, mode: 'payment', client_reference_id: 'order',
    metadata: { orderId: 'order', userId: 'owner' }, currency: 'usd', amount_total: 299, amount_subtotal: 299,
    total_details: { amount_tax: 0, amount_discount: 0, amount_shipping: 0 }, automatic_tax: { enabled: false },
    line_items: { has_more: false, data: [{ quantity: 1, price: { id: 'price_test' }, amount_total: 299 }] },
  } as unknown as Stripe.Checkout.Session;
  assert.doesNotThrow(() => validateSession(order, session));
  assert.doesNotThrow(() => validateSession(order, { ...session, status: 'expired', payment_intent: null }));
  for (const change of [{ livemode: true }, { amount_total: 1 }, { currency: 'eur' }, { metadata: { orderId: 'order', userId: 'other' } },
    { total_details: { amount_tax: 1, amount_discount: 0, amount_shipping: 0 } }, { line_items: { data: [{ quantity: 2 }] } }]) {
    assert.throws(() => validateSession(order, { ...session, ...change } as Stripe.Checkout.Session), /verification/);
  }
});
test('checkout URLs require the exact HTTPS Stripe origin without credentials or ports', () => {
  assert.equal(validCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test'), true);
  for (const url of ['http://checkout.stripe.com/c/pay/x', 'https://checkout.stripe.com:443/c/pay/x',
    'https://user@checkout.stripe.com/c/pay/x', 'https://checkout.stripe.com.example/c/pay/x', 'not a url']) {
    assert.equal(validCheckoutUrl(url), false, url);
  }
});