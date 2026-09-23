import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgeDiscovery,
  discoveryKey,
  readDiscovery,
  reconcileDiscovery,
  writeDiscovery,
  type CollectionDiscoveryState,
  type CollectionDiscoveryStorage,
  type DiscoveryOpening,
} from './collectionCardDiscovery';

class MemoryStorage implements CollectionDiscoveryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-15T12:00:00Z');
const state = (
  knownCardIds: string[],
  pendingCardIds: string[] = [],
): CollectionDiscoveryState => ({ version: 1, knownCardIds, pendingCardIds });
const opening = (
  createdAt: string,
  rewards: DiscoveryOpening['rewards'],
): DiscoveryOpening => ({ createdAt, rewards });

test('stores collection discovery independently for each encoded player profile', () => {
  const storage = new MemoryStorage();
  assert.equal(discoveryKey('player/a'), 'squabblemon:collection-card-discovery:v1:player%2Fa');
  assert.notEqual(discoveryKey('player/a'), discoveryKey('player-a'));
  assert.equal(writeDiscovery('player/a', state(['alpha'], ['alpha']), storage), true);
  assert.equal(writeDiscovery('player-b', state(['beta']), storage), true);
  assert.deepEqual(readDiscovery('player/a', storage), state(['alpha'], ['alpha']));
  assert.deepEqual(readDiscovery('player-b', storage), state(['beta']));
});

test('first visit seeds only owned genuine new card receipts from the last seven days', () => {
  const result = reconcileDiscovery(
    ['old-card', 'recent-card', 'duplicate-card', 'variant-card', 'unowned-card'],
    [
      opening(new Date(NOW - DAY).toISOString(), [
        { kind: 'card', cardId: 'recent-card', isNew: true },
        { kind: 'card', cardId: 'duplicate-card', isNew: false },
        { kind: 'variant', cardId: 'variant-card', isNew: true },
        { kind: 'card', cardId: 'not-owned', isNew: true },
        { kind: 'currency', isNew: true },
      ]),
      opening(new Date(NOW - 8 * DAY).toISOString(), [
        { kind: 'card', cardId: 'old-card', isNew: true },
      ]),
    ],
    null,
    NOW,
  );
  assert.deepEqual(result.knownCardIds, [
    'old-card', 'recent-card', 'duplicate-card', 'variant-card', 'unowned-card',
  ]);
  assert.deepEqual(result.pendingCardIds, ['recent-card']);
});

test('the first-visit window excludes invalid and future receipts and includes its boundary', () => {
  const result = reconcileDiscovery(
    ['boundary', 'future', 'invalid'],
    [
      opening(new Date(NOW - 7 * DAY).toISOString(), [
        { kind: 'card', cardId: 'boundary', isNew: true },
      ]),
      opening(new Date(NOW + 1).toISOString(), [
        { kind: 'card', cardId: 'future', isNew: true },
      ]),
      opening('not-a-date', [
        { kind: 'card', cardId: 'invalid', isNew: true },
      ]),
    ],
    null,
    NOW,
  );
  assert.deepEqual(result.pendingCardIds, ['boundary']);
});

test('a baseline discovers newly owned cards after long absence even when receipts rolled off', () => {
  const result = reconcileDiscovery(
    ['known', 'new-without-receipt', 'another-new'],
    [],
    state(['known']),
    NOW,
  );
  assert.deepEqual(result.knownCardIds, ['known', 'new-without-receipt', 'another-new']);
  assert.deepEqual(result.pendingCardIds, ['another-new', 'new-without-receipt']);
});

test('pending order follows newest opening then reward order with deterministic fallbacks', () => {
  const result = reconcileDiscovery(
    ['known', 'old-pending', 'z-diff', 'a-diff', 'newer-one', 'newer-two', 'older'],
    [
      opening('2026-09-10T12:00:00Z', [
        { kind: 'card', cardId: 'older', isNew: true },
      ]),
      opening('2026-09-14T12:00:00Z', [
        { kind: 'card', cardId: 'newer-one', isNew: true },
        { kind: 'card', cardId: 'newer-two', isNew: true },
      ]),
    ],
    state(['known'], ['old-pending']),
    NOW,
  );
  assert.deepEqual(result.pendingCardIds, [
    'newer-one', 'newer-two', 'older', 'old-pending', 'a-diff', 'z-diff',
  ]);
});

test('reconciliation preserves an interrupted visit but drops pending cards no longer owned', () => {
  const result = reconcileDiscovery(
    ['known', 'still-unseen'],
    [],
    state(['known', 'removed'], ['still-unseen', 'removed']),
    NOW,
  );
  assert.deepEqual(result.knownCardIds, ['known', 'removed', 'still-unseen']);
  assert.deepEqual(result.pendingCardIds, ['still-unseen']);
});

test('duplicate receipts and repeated owned IDs produce one pending card', () => {
  const result = reconcileDiscovery(
    ['card-a', 'card-a'],
    [
      opening('2026-09-14T12:00:00Z', [
        { kind: 'card', cardId: 'card-a', isNew: true },
        { kind: 'card', cardId: 'card-a', isNew: true },
      ]),
    ],
    null,
    NOW,
  );
  assert.deepEqual(result, state(['card-a'], ['card-a']));
});

test('acknowledgement removes only specified pending IDs and is idempotent', () => {
  const original = state(['a', 'b', 'c'], ['a', 'b', 'c']);
  const acknowledged = acknowledgeDiscovery(original, ['b', 'missing', 'b']);
  assert.deepEqual(acknowledged, state(['a', 'b', 'c'], ['a', 'c']));
  assert.deepEqual(acknowledgeDiscovery(acknowledged, ['b']), acknowledged);
  assert.deepEqual(original.pendingCardIds, ['a', 'b', 'c']);
});

test('missing, corrupt, and denied storage are handled safely', () => {
  const storage = new MemoryStorage();
  assert.equal(readDiscovery('missing', null), null);
  storage.setItem(discoveryKey('broken-json'), '{');
  storage.setItem(discoveryKey('wrong-version'), JSON.stringify({
    version: 2, knownCardIds: [], pendingCardIds: [],
  }));
  storage.setItem(discoveryKey('wrong-arrays'), JSON.stringify({
    version: 1, knownCardIds: ['ok', 2], pendingCardIds: [],
  }));
  assert.equal(readDiscovery('broken-json', storage), null);
  assert.equal(readDiscovery('wrong-version', storage), null);
  assert.equal(readDiscovery('wrong-arrays', storage), null);

  const denied = {
    getItem(): string | null { throw new Error('denied'); },
    setItem(): void { throw new Error('denied'); },
  };
  assert.equal(readDiscovery('player', denied), null);
  assert.equal(writeDiscovery('player', state([]), denied), false);
  assert.equal(writeDiscovery('player', state([]), null), true);
});