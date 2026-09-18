import assert from 'node:assert/strict';
import test from 'node:test';
import { finishPackOpening, loadPackOpening, loadPackRequest, reservePackRequest, savePackOpening } from './packJournal.ts';
import type { PackOpening } from '@workspace/api-client-react';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
const receipt: PackOpening = { id: 'opening-one', oddsVersion: '1', paymentMethod: 'ticket', cost: 1, pityBefore: 0, pityAfter: 1, createdAt: '2026-09-08T00:00:00Z', rewards: [{ kind: 'styleShards', cardId: null, variantId: null, name: 'Style Shards', rarity: null, isNew: false, amount: 25 }] };

test('a retry after an uncertain response preserves both the payment method and request key', () => {
  const storage = memoryStorage();
  const first = reservePackRequest(storage, 'player-a', 'ticket', () => 'request-one');
  const retry = reservePackRequest(storage, 'player-a', 'softCurrency', () => { throw new Error('Must not create another charge'); });
  assert.deepEqual(retry, first);
  assert.equal(retry.paymentMethod, 'ticket');
  assert.equal(loadPackRequest(storage, 'player-b'), null);
});
test('a completed opening is recoverable after remount and clears only its own request', () => {
  const storage = memoryStorage();
  reservePackRequest(storage, 'player-a', 'ticket', () => 'one');
  reservePackRequest(storage, 'player-b', 'ticket', () => 'two');
  savePackOpening(storage, 'player-a', receipt);
  assert.deepEqual(loadPackOpening(storage, 'player-a'), receipt);
  assert.equal(loadPackRequest(storage, 'player-a'), null);
  assert.equal(loadPackRequest(storage, 'player-b')?.idempotencyKey, 'two');
  finishPackOpening(storage, 'player-a');
  assert.equal(loadPackOpening(storage, 'player-a'), null);
});
test('a receipt storage failure retains the request for a safe server retry', () => {
  const storage = memoryStorage();
  reservePackRequest(storage, 'player-a', 'ticket', () => 'request-one');
  const full = { ...storage, setItem: () => { throw new Error('Storage full'); } };
  assert.throws(() => savePackOpening(full, 'player-a', receipt));
  assert.equal(loadPackRequest(storage, 'player-a')?.idempotencyKey, 'request-one');
});
test('malformed local data never becomes an opening or payment intent', () => {
  const storage = memoryStorage();
  storage.setItem('squabblemon:pack-request:player-a', '{');
  storage.setItem('squabblemon:pack-reveal:player-a', JSON.stringify({ id: 'bad', rewards: [null] }));
  assert.equal(loadPackRequest(storage, 'player-a'), null);
  assert.equal(loadPackOpening(storage, 'player-a'), null);
});
