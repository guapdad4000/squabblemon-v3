import assert from 'node:assert/strict';
import test from 'node:test';
import { finishPackOpening, loadPackOpening, loadPackRequest, reservePackRequest, savePackOpening, saveCurrentPackOpening } from './packJournal.ts';
import type { PackOpening } from '@workspace/api-client-react';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
const receipt: PackOpening = { id: 'opening-one', oddsVersion: '1', paymentMethod: 'ticket', cost: 1, pullCount: 1, pityBefore: 0, pityAfter: 1, createdAt: '2026-09-08T00:00:00Z', rewards: [{ kind: 'styleShards', cardId: null, variantId: null, name: 'Style Shards', rarity: null, isNew: false, amount: 25 }] };

test('a retry after an uncertain response preserves both the payment method and request key', () => {
  const storage = memoryStorage();
  const first = reservePackRequest(storage, 'player-a', 'ticket', () => 'request-one');
  const retry = reservePackRequest(storage, 'player-a', 'softCurrency', () => { throw new Error('Must not create another charge'); });
  assert.deepEqual(retry, first);
  assert.equal(retry.paymentMethod, 'ticket');
  assert.equal(loadPackRequest(storage, 'player-b'), null);
});
test('a ten-pull retry preserves its original size, payment method, and request key', () => {
  const storage = memoryStorage();
  const first = reservePackRequest(storage, 'player-a', 'ticket', () => 'request-ten', 10);
  const retry = reservePackRequest(storage, 'player-a', 'softCurrency', () => { throw new Error('Must not create another charge'); }, 1);
  assert.deepEqual(first, { idempotencyKey: 'request-ten', paymentMethod: 'ticket', pullCount: 10 });
  assert.deepEqual(retry, first);
  assert.equal(loadPackRequest(storage, 'player-a')?.pullCount, 10);
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

test('a retry preserves the featured banner even if a different banner is requested', () => {
  const storage = memoryStorage();
  const first = reservePackRequest(storage, 'banner-player', 'ticket', () => 'banner-request', 10, 'red-blue');
  const retry = reservePackRequest(storage, 'banner-player', 'softCurrency', () => 'unused', 1, 'oz');
  assert.deepEqual(retry, first);
  assert.equal(loadPackRequest(storage, 'banner-player')?.bannerId, 'red-blue');
});


test('pending weekly intent survives a rotation, remount, and return of the same theme', () => {
  const storage = memoryStorage();
  const first = reservePackRequest(storage, 'weekly-player', 'ticket', () => 'weekly-request', 10, 'inmates', 'inmates:2026-10-19');
  assert.equal(loadPackRequest(storage, 'weekly-player')?.bannerOccurrenceId, 'inmates:2026-10-19');
  for (const [bannerId, occurrence] of [['oz', 'oz:2026-10-26'], ['inmates', 'inmates:2026-11-16']]) {
    assert.deepEqual(reservePackRequest(storage, 'weekly-player', 'softCurrency', () => { throw new Error('Must not create a second payment'); }, 1, bannerId, occurrence), first);
  }
  storage.setItem('squabblemon:pack-request:weekly-player', JSON.stringify({ ...first, bannerOccurrenceId: 12 }));
  assert.equal(loadPackRequest(storage, 'weekly-player'), null);
});

test('partial batch retry and monthly bonus receipt survive a refresh without changing purchase intent', () => {
  const storage = memoryStorage();
  const request = reservePackRequest(storage, 'partial', 'ticket', () => 'partial-request', 7, 'inmates', 'inmates:2026-10-19');
  assert.deepEqual(reservePackRequest(storage, 'partial', 'softCurrency', () => 'never', 1, 'oz'), request);
  const opening = { ...receipt, pullCount: 7, oddsVersion: 'street-pack-batch-7-v1', seasonRewards: [{ seasonId: '2026-10', threshold: 5, softCurrency: 100, packTickets: 0, styleShards: 0 }] };
  savePackOpening(storage, 'partial', opening);
  assert.deepEqual(loadPackOpening(storage, 'partial'), opening);
  for (const count of [0, 1.5, 11, '3']) {
    storage.setItem('squabblemon:pack-request:bad', JSON.stringify({ ...request, pullCount: count }));
    assert.equal(loadPackRequest(storage, 'bad'), null);
  }
});


test('late response A cannot erase the newer B request after A was recovered and finished', () => {
  const storage=memoryStorage();
  const requestA=reservePackRequest(storage,'player-a','ticket',()=> 'request-a');
  assert.equal(saveCurrentPackOpening(storage,'player-a',requestA,receipt),true);
  finishPackOpening(storage,'player-a');
  const requestB=reservePackRequest(storage,'player-a','softCurrency',()=> 'request-b',7,'inmates','inmates:2026-10-19');
  assert.equal(saveCurrentPackOpening(storage,'player-a',requestA,receipt),false);
  assert.deepEqual(loadPackRequest(storage,'player-a'),requestB);
  assert.equal(loadPackOpening(storage,'player-a'),null);
});
test('late response A cannot replace the saved B reveal', () => {
  const storage=memoryStorage();
  const requestA=reservePackRequest(storage,'player-a','ticket',()=> 'request-a');
  saveCurrentPackOpening(storage,'player-a',requestA,receipt);finishPackOpening(storage,'player-a');
  const requestB=reservePackRequest(storage,'player-a','ticket',()=> 'request-b');
  const receiptB={...receipt,id:'opening-b'};
  assert.equal(saveCurrentPackOpening(storage,'player-a',requestB,receiptB),true);
  assert.equal(saveCurrentPackOpening(storage,'player-a',requestA,receipt),false);
  assert.deepEqual(loadPackOpening(storage,'player-a'),receiptB);
  assert.equal(loadPackRequest(storage,'player-a'),null);
});
test('same receipt retry and original-account persistence remain valid after account navigation', () => {
  const storage=memoryStorage();
  const requestA=reservePackRequest(storage,'player-a','ticket',()=> 'request-a');
  const requestB=reservePackRequest(storage,'player-b','ticket',()=> 'request-b');
  assert.equal(saveCurrentPackOpening(storage,'player-a',requestA,receipt),true);
  assert.equal(saveCurrentPackOpening(storage,'player-a',requestA,receipt),true);
  assert.deepEqual(loadPackOpening(storage,'player-a'),receipt);
  assert.deepEqual(loadPackRequest(storage,'player-b'),requestB);
});
test('a reused key with changed payment intent cannot be consumed by an old response', () => {
  const storage=memoryStorage();
  const original=reservePackRequest(storage,'player-a','ticket',()=> 'request-a',7,'inmates','inmates:2026-10-19');
  for (const patch of [{paymentMethod:'softCurrency'},{pullCount:10},{bannerId:'oz'},{bannerOccurrenceId:'inmates:2026-11-16'}]) {
    storage.setItem('squabblemon:pack-request:player-a',JSON.stringify({...original,...patch}));
    assert.equal(saveCurrentPackOpening(storage,'player-a',original,receipt),false);
    assert.deepEqual(loadPackRequest(storage,'player-a'),{...original,...patch});
  }
});
