import assert from 'node:assert/strict';
import test from 'node:test';
import { syncCinemaNavWithStoryOverlay } from './GameNav';

test('Cinema navigation closes and suppresses when a story node overlay mounts', () => {
  let closeCalls = 0;
  const sheet = {
    open: true,
    close: () => { closeCalls += 1; },
  };
  const root = {
    querySelector: (selector: string) => selector === '.story-node-overlay' ? {} as Element : null,
  };

  assert.equal(syncCinemaNavWithStoryOverlay(sheet, root), true);
  assert.equal(closeCalls, 1);
});

test('Cinema navigation remains available when no story node overlay exists', () => {
  let closeCalls = 0;
  const sheet = {
    open: true,
    close: () => { closeCalls += 1; },
  };
  const root = { querySelector: () => null };

  assert.equal(syncCinemaNavWithStoryOverlay(sheet, root), false);
  assert.equal(closeCalls, 0);
});
