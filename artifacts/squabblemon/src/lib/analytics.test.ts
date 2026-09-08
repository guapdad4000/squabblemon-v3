import assert from 'node:assert/strict';
import test from 'node:test';
import { decisionTimeBucket, trackEvent } from './analytics';

test('decision timing is reduced to privacy-safe coarse buckets', () => {
  assert.equal(decisionTimeBucket(1_000, 3_999), 'under_3s');
  assert.equal(decisionTimeBucket(1_000, 4_000), '3_to_8s');
  assert.equal(decisionTimeBucket(1_000, 9_000), '8_to_15s');
  assert.equal(decisionTimeBucket(1_000, 16_000), '15s_or_more');
});

test('analytics is a no-op when the injected tracker is absent', () => {
  assert.doesNotThrow(() => trackEvent('battle_history_opened', { round: 1 }));
});

test('analytics reaches the Replit-injected tracker when present', () => {
  const originalWindow = globalThis.window;
  const calls: Array<{ name: string, data?: Record<string, string | number | boolean> }> = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { umami: { track: (name: string, data?: Record<string, string | number | boolean>) => calls.push({ name, data }) } },
  });

  try {
    trackEvent('battle_squabble_toggled', { round: 2, action: 'cancel' });
    assert.deepEqual(calls, [{
      name: 'battle_squabble_toggled',
      data: { round: 2, action: 'cancel' },
    }]);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});

test('analytics failures never escape into gameplay', () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { umami: { track: () => { throw new Error('tracker unavailable'); } } },
  });

  try {
    assert.doesNotThrow(() => trackEvent('battle_turn_committed', { action: 'pass' }));
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});