import test from 'node:test';
import assert from 'node:assert/strict';
import { shopPurchaseDestination } from './shopDestination';

test('moved purchases recover on their current counter with the selected card intact', () => {
  for (const itemId of ['tagged-style', 'chrome-style'] as const) {
    const url = new URL(shopPurchaseDestination({ itemId, cardId: 'big zoey&card=other' }), 'https://squabble.test');
    assert.equal(url.pathname, '/game/style');
    assert.equal(url.searchParams.get('view'), 'finishes');
    assert.equal(url.searchParams.get('item'), itemId);
    assert.equal(url.searchParams.get('card'), 'big zoey&card=other');
  }
  assert.equal(shopPurchaseDestination({ itemId: 'common-recruit' }), '/game/shop?view=packs&banner=neighborhood');
  assert.equal(new URL(shopPurchaseDestination({ itemId: 'common-recruit', cardId: 'cornball' }), 'https://squabble.test').searchParams.get('card'), 'cornball');
  assert.equal(shopPurchaseDestination({ itemId: 'deck-slot' }), '/game/shop?view=corner&item=deck-slot');
  for (const itemId of ['training', 'training-intensive', 'move-training'] as const) {
    const url = new URL(shopPurchaseDestination({ itemId, cardId: 'buddy' }), 'https://squabble.test');
    assert.equal(url.searchParams.get('view'), 'training');
    assert.equal(url.searchParams.get('item'), itemId);
    assert.equal(url.searchParams.get('card'), 'buddy');
  }
});

test('existing cosmetic and ticket services keep their established destinations', () => {
  assert.equal(shopPurchaseDestination({ itemId: 'player-mat' }), '/game/style?view=mats');
  assert.equal(shopPurchaseDestination({ itemId: 'character-stickers', cardId: 'buddy' }), '/game/style/buddy');
  assert.equal(shopPurchaseDestination({ itemId: 'ticket' }), '/game/shop?view=packs');
});
