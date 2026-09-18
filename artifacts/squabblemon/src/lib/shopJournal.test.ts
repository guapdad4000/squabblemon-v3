import assert from 'node:assert/strict';
import test from 'node:test';
import { readShopRequest, saveShopRequest, clearShopRequest } from './shopJournal';
const request = { idempotencyKey: '89dbe5b8-9512-4a27-9938-44e589bcc653', itemId: 'ticket' as const };
const memory = () => { const values = new Map<string,string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value: string) => { values.set(key,value); }, removeItem: (key: string) => { values.delete(key); } }; };
test('a pending purchase survives navigation and is isolated to its player', () => {
  const storage = memory(); saveShopRequest(storage, 'player-a', request);
  assert.deepEqual(readShopRequest(storage, 'player-a'), request);
  assert.equal(readShopRequest(storage, 'player-b'), null);
  clearShopRequest(storage, 'player-a'); assert.equal(readShopRequest(storage, 'player-a'), null);
});
test('broken storage and malformed purchase requests cannot become replay requests', () => {
  assert.equal(readShopRequest({getItem: () => { throw new Error('Unavailable'); }}, 'player-a'), null);
  for (const value of ['broken', JSON.stringify({...request, itemId:'free-money'}), JSON.stringify({...request,idempotencyKey:'-'.repeat(36)})]) {
    assert.equal(readShopRequest({getItem: () => value}, 'player-a'), null);
  }
});
