import assert from 'node:assert/strict';
import test from 'node:test';
import { quotePullPayment, type PullPaymentQuoteInput } from './pullPayment.ts';

const multi = {
  selectedCount: 10, supportsFlexibleBatches: true,
} as const;

test('Single stays one even when a full ten is affordable', () => {
  assert.deepEqual(quotePullPayment({ ...multi, selectedCount: 1, paymentMethod: 'ticket', balance: 50 }), { count: 1, cost: 1 });
  assert.deepEqual(quotePullPayment({ ...multi, selectedCount: 1, paymentMethod: 'softCurrency', balance: 5000 }), { count: 1, cost: 200 });
});

test('Multi uses seven available tickets without needing a separate batch control', () => {
  assert.deepEqual(quotePullPayment({ ...multi, paymentMethod: 'ticket', balance: 7 }), { count: 7, cost: 7 });
});

test('Multi uses only whole affordable packs from 750 Clout', () => {
  assert.deepEqual(quotePullPayment({ ...multi, paymentMethod: 'softCurrency', balance: 750 }), { count: 3, cost: 600 });
});

test('exactly 1800 Clout buys the discounted full ten, with the correct lower boundary', () => {
  assert.deepEqual(quotePullPayment({ ...multi, paymentMethod: 'softCurrency', balance: 1799 }), { count: 8, cost: 1600 });
  assert.deepEqual(quotePullPayment({ ...multi, paymentMethod: 'softCurrency', balance: 1800 }), { count: 10, cost: 1800 });
});

test('zero or invalid balance quotes one at its real price so the UI can disable payment', () => {
  for (const balance of [0, -1, NaN, Infinity]) {
    assert.deepEqual(quotePullPayment({ ...multi, paymentMethod: 'ticket', balance }), { count: 1, cost: 1 });
    assert.deepEqual(quotePullPayment({ ...multi, paymentMethod: 'softCurrency', balance }), { count: 1, cost: 200 });
  }
});

test('large balances never quote more than ten packs', () => {
  assert.deepEqual(quotePullPayment({ ...multi, paymentMethod: 'ticket', balance: 999 }), { count: 10, cost: 10 });
  assert.deepEqual(quotePullPayment({ ...multi, paymentMethod: 'softCurrency', balance: 999999 }), { count: 10, cost: 1800 });
});

test('any non-single selection uses Multi affordability instead of a stale prior batch size', () => {
  assert.deepEqual(quotePullPayment({ ...multi, selectedCount: 3, paymentMethod: 'ticket', balance: 7 }), { count: 7, cost: 7 });
  assert.deepEqual(quotePullPayment({ ...multi, selectedCount: 7, paymentMethod: 'ticket', balance: 1 }), { count: 1, cost: 1 });
});

test('an older API keeps Multi at ten even when the balance only supports a partial batch', () => {
  assert.deepEqual(quotePullPayment({ ...multi, supportsFlexibleBatches: false, paymentMethod: 'ticket', balance: 7 }), { count: 10, cost: 10 });
  assert.deepEqual(quotePullPayment({ ...multi, selectedCount: 3, supportsFlexibleBatches: false, paymentMethod: 'softCurrency', balance: 750 }), { count: 10, cost: 1800 });
  assert.deepEqual(quotePullPayment({ ...multi, selectedCount: 1, supportsFlexibleBatches: false, paymentMethod: 'ticket', balance: 7 }), { count: 1, cost: 1 });
});

test('saved seven-pack intent wins over Single, changed balances and missing batch capability', () => {
  for (const balance of [0, 2, 10000]) {
    for (const supportsFlexibleBatches of [false, true]) {
      const saved = { selectedCount: 1, pendingCount: 7, balance, supportsFlexibleBatches } as const;
      assert.deepEqual(quotePullPayment({ ...saved, paymentMethod: 'ticket' }), { count: 7, cost: 7 });
      assert.deepEqual(quotePullPayment({ ...saved, paymentMethod: 'softCurrency' }), { count: 7, cost: 1400 });
    }
  }
});

test('saved single and discounted ten intents also stay exact under a changed mode', () => {
  const input: PullPaymentQuoteInput = { ...multi, paymentMethod: 'softCurrency', balance: 0, pendingCount: 1 };
  assert.deepEqual(quotePullPayment(input), { count: 1, cost: 200 });
  assert.deepEqual(quotePullPayment({ ...input, selectedCount: 1, pendingCount: 10 }), { count: 10, cost: 1800 });
});
