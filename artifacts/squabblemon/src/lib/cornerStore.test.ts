import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutDemo, emptyDemoWallet, readDemoWallet } from './cornerStore';

test('demo checkout credits Clout, debits purchases, and preserves the input wallet', () => {
  const original = emptyDemoWallet();
  const funded = checkoutDemo(original, 'clout-pocket', 'topup', 'now');
  const bought = checkoutDemo(funded, 'wiz-pack', 'pack', 'now');
  assert.equal(original.clout, 0);
  assert.equal(funded.clout, 500);
  assert.equal(bought.clout, 100);
  assert.equal(bought.receipts.length, 2);
  assert.throws(() => checkoutDemo(bought, 'wonder-pack', 'too-much', 'now'), /Add demo Clout/);
});
test('duplicate checkout is idempotent and a style cannot be bought twice', () => {
  const funded = checkoutDemo(emptyDemoWallet(), 'clout-pocket', 'topup', 'now');
  assert.equal(checkoutDemo(funded, 'clout-pocket', 'topup', 'now'), funded);
  const styled = checkoutDemo(funded, 'dorothy-style', 'style', 'now');
  assert.throws(() => checkoutDemo(styled, 'dorothy-style', 'style-again', 'now'), /already/);
});
test('persisted purchases survive reload; malformed storage fails safely', () => {
  const wallet = checkoutDemo(emptyDemoWallet(), 'clout-stack', 'topup', 'now');
  assert.deepEqual(readDemoWallet({ getItem: () => JSON.stringify(wallet) }, 'demo'), wallet);
  for (const raw of ['not json', '{"version":1,"clout":-1,"receipts":[]}', 'null']) {
    assert.deepEqual(readDemoWallet({ getItem: () => raw }, 'demo'), emptyDemoWallet());
  }
  assert.deepEqual(readDemoWallet({ getItem: () => { throw new Error('blocked storage'); } }, 'demo'), emptyDemoWallet());
});
test('styles remain owned after a long purchase history', () => {
  let wallet = checkoutDemo(emptyDemoWallet(), 'clout-stack', 'start', 'now');
  wallet = checkoutDemo(wallet, 'dorothy-style', 'style', 'now');
  for (let i = 0; i < 110; i++) wallet = checkoutDemo(wallet, 'clout-pocket', String(i), 'now');
  const restored = readDemoWallet({ getItem: () => JSON.stringify(wallet) }, 'demo');
  assert.throws(() => checkoutDemo(restored, 'dorothy-style', 'again', 'now'), /already/);
});
