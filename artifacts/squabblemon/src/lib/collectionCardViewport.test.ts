import assert from 'node:assert/strict';
import test from 'node:test';
import { updateCollectionCardViewport } from './collectionCardViewport';

test('a 300-card collection retains only the nearby window as the player scrolls', () => {
  const ids = Array.from({ length: 300 }, (_, i) => `card-${i}`);
  const first = updateCollectionCardViewport(new Set(), ids.map((cardId, i) => ({ cardId, visible: i < 24 })));
  assert.equal(first.size, 24);
  const deep = updateCollectionCardViewport(first, ids.map((cardId, i) => ({ cardId, visible: i >= 260 && i < 284 })));
  assert.equal(deep.size, 24);
  assert.equal(deep.has('card-0'), false);
  assert.equal(deep.has('card-260'), true);
  assert.equal(first.has('card-0'), true, 'observer updates do not mutate React state');
});

test('unchanged entries retain state identity and avoid redundant collection renders', () => {
  const current = new Set(['nearby']);
  assert.equal(updateCollectionCardViewport(current, [
    { cardId: 'nearby', visible: true }, { cardId: 'distant', visible: false }, { cardId: '', visible: true },
  ]), current);
});

test('batched entries can replace a window and process repeated targets in order', () => {
  const current = new Set(['old']);
  assert.deepEqual([...updateCollectionCardViewport(current, [
    { cardId: 'old', visible: false }, { cardId: 'new', visible: true },
    { cardId: 'brief', visible: true }, { cardId: 'brief', visible: false },
  ])], ['new']);
});
