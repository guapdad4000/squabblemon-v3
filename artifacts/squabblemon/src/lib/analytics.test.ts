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

test('battle analytics drops unexpected private fields and invalid values before tracking', () => {
  const originalWindow = globalThis.window;
  const calls: Array<{ name: string, data?: Record<string, string | number | boolean> }> = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { umami: { track: (name: string, data?: Record<string, string | number | boolean>) => calls.push({ name, data }) } },
  });

  try {
    trackEvent('battle_turn_committed', {
      round: 3,
      action: 'lock_in',
      automatic: false,
      squabble: true,
      decision_time: '3_to_8s',
      district: 2,
      card_instance_id: 'card-instance-private',
      account_id: 'account-private',
      email: 'player@example.com',
    } as Record<string, string | number | boolean>);
    trackEvent('battle_squabble_toggled', {
      round: 3,
      action: 'private-card-instance',
      decision_time: 'exactly_4.283_seconds',
    });

    assert.deepEqual(calls, [
      {
        name: 'battle_turn_committed',
        data: {
          round: 3,
          action: 'lock_in',
          automatic: false,
          squabble: true,
          decision_time: '3_to_8s',
          district: 2,
        },
      },
      {
        name: 'battle_squabble_toggled',
        data: { round: 3 },
      },
    ]);
    assert.doesNotMatch(JSON.stringify(calls), /card-instance-private|account-private|player@example\.com/);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});

test('tutorial analytics only accepts fixed step and mechanic identifiers', () => {
  const originalWindow = globalThis.window;
  const calls: Array<{ name: string, data?: Record<string, string | number | boolean> }> = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { umami: { track: (name: string, data?: Record<string, string | number | boolean>) => calls.push({ name, data }) } },
  });

  try {
    trackEvent('tutorial_step_shown', { round: 1, step: 'r1_choose_card', card_id: 'private-card' } as Record<string, string | number | boolean>);
    trackEvent('mechanic_lesson_dismissed', { lesson: 'burn', account_id: 'private-account' } as Record<string, string | number | boolean>);
    trackEvent('mechanic_lesson_shown', { lesson: 'made_up_status' });
    assert.deepEqual(calls, [
      { name: 'tutorial_step_shown', data: { round: 1, step: 'r1_choose_card' } },
      { name: 'mechanic_lesson_dismissed', data: { lesson: 'burn' } },
      { name: 'mechanic_lesson_shown', data: {} },
    ]);
    assert.doesNotMatch(JSON.stringify(calls), /private-card|private-account|made_up_status/);
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